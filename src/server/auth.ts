import { PrivyClient } from "@privy-io/node";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { eq, and, inArray, notInArray } from "drizzle-orm";
import { getDb } from "./db";
import { users, walletLinks, ensIdentities } from "./db/schema";
import { applyWrite } from "./db/write";
import { config, isDemo } from "./config";
import { AppError, invariant } from "./errors";
import { DEMO_ACTORS } from "./db/seed";

const runtime = globalThis as typeof globalThis & { __nftechDemoKey?: Uint8Array };
function demoKey() {
  return (runtime.__nftechDemoKey ??= randomBytes(32));
}
let privyClient: PrivyClient | undefined;
export function privy() {
  const env = config();
  invariant(
    env.privyAppId && env.privySecret,
    "AUTH_UNCONFIGURED",
    "Sign-in is not configured yet.",
    503,
  );
  return (privyClient ??= new PrivyClient({ appId: env.privyAppId, appSecret: env.privySecret }));
}
export async function demoSession(actor: string) {
  invariant(isDemo(), "NOT_FOUND", "Not found.", 404);
  const selected = DEMO_ACTORS.find((item) => item.key === actor);
  invariant(selected, "INVALID_ACTOR", "Choose a demo account.", 422);
  await getDb();
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(selected.id)
    .setIssuer("nftech-local-demo")
    .setAudience("nftech-local-demo")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(demoKey());
}
export async function actorFromRequest(request: Request, required = true) {
  const db = await getDb();
  let subject: string | undefined;
  if (isDemo()) {
    const token = request.headers
      .get("cookie")
      ?.split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("nftech_demo="))
      ?.slice(12);
    if (token) {
      try {
        subject = (
          await jwtVerify(token, demoKey(), {
            algorithms: ["HS256"],
            issuer: "nftech-local-demo",
            audience: "nftech-local-demo",
          })
        ).payload.sub;
      } catch {
        throw new AppError("UNAUTHENTICATED", "Please sign in again.", 401);
      }
    }
    if (!subject) {
      if (required) throw new AppError("UNAUTHENTICATED", "Sign in to continue.", 401);
      return null;
    }
    const [user] = await db.select().from(users).where(eq(users.id, subject)).limit(1);
    invariant(user && !user.suspended, "FORBIDDEN", "This account is unavailable.", 403);
    return user;
  }
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) {
    if (required) throw new AppError("UNAUTHENTICATED", "Sign in to continue.", 401);
    return null;
  }
  const provider = privy();
  try {
    subject = (await provider.utils().auth().verifyAccessToken(token)).user_id;
  } catch {
    throw new AppError("UNAUTHENTICATED", "Your session expired. Sign in again.", 401);
  }
  let [user] = await db.select().from(users).where(eq(users.authSubject, subject)).limit(1);
  if (!user) {
    invariant(
      config().enrollmentOpen,
      "ENROLLMENT_CLOSED",
      "New registrations are temporarily paused.",
      503,
    );
    user = await applyWrite(null, "user.create", subject, async (tx) => {
      await tx
        .insert(users)
        .values({ authSubject: subject!, name: "New friend" })
        .onConflictDoNothing();
      return (await tx.select().from(users).where(eq(users.authSubject, subject!)).limit(1))[0];
    });
  }
  invariant(user && !user.suspended, "FORBIDDEN", "This account is unavailable.", 403);
  return user;
}
export async function syncVerifiedWallets(userId: string, authSubject: string) {
  const db = await getDb();
  if (isDemo())
    return (await db.select().from(walletLinks).where(eq(walletLinks.userId, userId))).map(
      (row) => row.address,
    );
  const providerUser = await privy().users()._get(authSubject);
  const addresses = [
    ...new Set(
      providerUser.linked_accounts
        .filter((account) => account.type === "wallet" && account.chain_type === "ethereum")
        .map((account) => ("address" in account ? String(account.address).toLowerCase() : ""))
        .filter((address) => /^0x[0-9a-f]{40}$/.test(address)),
    ),
  ];
  await applyWrite(userId, "wallets.sync", userId, async (tx) => {
    // A wallet already assigned to another app account is never silently transferred.
    if (addresses.length) {
      const assigned = await tx
        .select()
        .from(walletLinks)
        .where(inArray(walletLinks.address, addresses));
      invariant(
        assigned.every((row) => row.userId === userId),
        "WALLET_CONFLICT",
        "This wallet is already linked to another account.",
        409,
      );
    }
    await tx
      .delete(walletLinks)
      .where(
        and(
          eq(walletLinks.userId, userId),
          addresses.length ? notInArray(walletLinks.address, addresses) : undefined,
        ),
      );
    await tx
      .update(ensIdentities)
      .set({ stale: true })
      .where(
        and(
          eq(ensIdentities.userId, userId),
          addresses.length ? notInArray(ensIdentities.address, addresses) : undefined,
        ),
      );
    for (const address of addresses)
      await tx
        .insert(walletLinks)
        .values({ userId, address })
        .onConflictDoUpdate({ target: walletLinks.address, set: { verifiedAt: new Date() } });
  });
  return addresses;
}
