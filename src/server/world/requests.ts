import { createHash, randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, type Tx } from "@/server/db";
import * as s from "@/server/db/schema";
import { invariant } from "@/server/errors";
import { world, WORLD_ACTION_TRIP, type ProofRequestDTO } from "./adapter";

/** Sort object keys so JSONB round trips cannot change what a proof authorizes. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ":" + canonical(item))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export function digest(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
export function tripPayload(body: {
  city: string;
  label?: string;
  arrivesAt: string;
  departsAt: string;
}) {
  return {
    city: body.city,
    label: body.label ?? null,
    arrivesAt: new Date(body.arrivesAt).toISOString(),
    departsAt: new Date(body.departsAt).toISOString(),
  };
}
export async function createTripProofRequest(
  user: s.UserRow,
  body: Parameters<typeof tripPayload>[0],
): Promise<ProofRequestDTO> {
  const rp = await world().rpContext(WORLD_ACTION_TRIP);
  const id = randomUUID();
  const payloadDigest = digest(tripPayload(body));
  const signal = digest({ purpose: "trip", userId: user.id, id, payloadDigest });
  await (await getDb()).insert(s.worldProofRequests).values({
    id,
    userId: user.id,
    payloadDigest,
    signal,
    rpContext: rp,
    expiresAt: new Date(Math.min(rp.expires_at * 1000, Date.now() + 5 * 60000)),
  });
  return { ...rp, requestId: id, signal };
}
export async function tripProofRequest(
  userId: string,
  id: string | undefined,
  body: Parameters<typeof tripPayload>[0],
) {
  invariant(id, "WORLD_REQUEST_REQUIRED", "Start a new World ID verification request.", 422);
  const [row] = await (
    await getDb()
  )
    .select()
    .from(s.worldProofRequests)
    .where(and(eq(s.worldProofRequests.id, id), eq(s.worldProofRequests.userId, userId)));
  invariant(
    row &&
      row.payloadDigest === digest(tripPayload(body)) &&
      !row.consumedAt &&
      row.expiresAt > new Date(),
    "WORLD_REQUEST_INVALID",
    "This World ID request was used, expired, or belongs to different trip details.",
    422,
  );
  return row;
}
export async function consumeTripProofRequest(tx: Tx, id: string, userId: string) {
  const rows = await tx
    .update(s.worldProofRequests)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(s.worldProofRequests.id, id),
        eq(s.worldProofRequests.userId, userId),
        isNull(s.worldProofRequests.consumedAt),
        gt(s.worldProofRequests.expiresAt, new Date()),
      ),
    )
    .returning({ id: s.worldProofRequests.id });
  invariant(
    rows.length === 1,
    "WORLD_REQUEST_INVALID",
    "This World ID request has expired or was already used.",
    409,
  );
}
