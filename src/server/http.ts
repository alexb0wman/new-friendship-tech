import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { rateLimits } from "./db/schema";
import { AppError, invariant } from "./errors";
import { config } from "./config";
export async function jsonBody(request: Request): Promise<unknown> {
  invariant(
    request.headers.get("content-type")?.includes("application/json"),
    "CONTENT_TYPE",
    "Use application/json.",
    415,
  );
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("VALIDATION", "A JSON body is required.", 422);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new AppError("BODY_TOO_LARGE", "Request is too large.", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("VALIDATION", "Invalid JSON.", 422);
  }
}
export function assertOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const env = config();
  let expected = env.origin;
  if (env.demo) {
    // Next may normalize Request.url to localhost even when the browser used 127.0.0.1.
    // Only local hosts are accepted; production always uses configured APP_ORIGIN.
    const url = new URL(request.url);
    const target = new URL(url.protocol + "//" + (request.headers.get("host") ?? url.host));
    invariant(
      ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname),
      "ORIGIN",
      "Local demo requires a loopback host.",
      403,
    );
    expected = target.origin;
  }
  invariant(
    request.headers.get("origin") === expected,
    "ORIGIN",
    "Request origin is not allowed.",
    403,
  );
}
export async function rateLimit(request: Request, actorId?: string) {
  const env = config();
  if (env.demo) return;
  const bucket =
    actorId ??
    (env.trustProxy ? (request.headers.get("cf-connecting-ip") ?? "anonymous") : "anonymous");
  const key = createHash("sha256").update(bucket).digest("hex");
  const limit = actorId ? 120 : 60,
    db = await getDb(),
    now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(rateLimits)
      .values({ key, count: 0, resetsAt: new Date(now.getTime() + 60000) })
      .onConflictDoNothing();
    const [row] = await tx.select().from(rateLimits).where(eq(rateLimits.key, key)).for("update");
    if (row.resetsAt <= now)
      await tx
        .update(rateLimits)
        .set({ count: 1, resetsAt: new Date(now.getTime() + 60000) })
        .where(eq(rateLimits.key, key));
    else {
      invariant(row.count < limit, "RATE_LIMIT", "Too many requests. Try again in a minute.", 429);
      await tx
        .update(rateLimits)
        .set({ count: row.count + 1 })
        .where(eq(rateLimits.key, key));
    }
  });
}
