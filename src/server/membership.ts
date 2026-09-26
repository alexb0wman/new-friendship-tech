import { and, eq, lte, gt, desc, count } from "drizzle-orm";
import { PLAN } from "@/lib/constants";
import { getDb, type Tx, type Database } from "./db";
import { entitlements, connectionRequests } from "./db/schema";
import { invariant } from "./errors";

export function nextPeriod(now: Date, paidThrough?: Date | null) {
  const startsAt = new Date(Math.max(now.getTime(), paidThrough?.getTime() ?? 0));
  return { startsAt, endsAt: new Date(startsAt.getTime() + PLAN.periodSeconds * 1000) };
}
export async function membership(userId: string, db?: Tx | Database, now = new Date()) {
  const store = db ?? (await getDb());
  const [current] = await store
    .select()
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        lte(entitlements.startsAt, now),
        gt(entitlements.endsAt, now),
      ),
    )
    .orderBy(desc(entitlements.endsAt))
    .limit(1);
  const [latest] = await store
    .select()
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .orderBy(desc(entitlements.endsAt))
    .limit(1);
  let used = 0;
  if (current) {
    const [usage] = await store
      .select({ count: count() })
      .from(connectionRequests)
      .where(
        and(
          eq(connectionRequests.senderId, userId),
          eq(connectionRequests.entitlementId, current.id),
        ),
      );
    used = Number(usage.count);
  }
  return {
    active: !!current,
    current: current
      ? {
          id: current.id,
          startsAt: current.startsAt.toISOString(),
          endsAt: current.endsAt.toISOString(),
          source: current.source,
        }
      : null,
    paidThrough: latest && latest.endsAt > now ? latest.endsAt.toISOString() : null,
    remainingRequests: current ? Math.max(0, PLAN.requestLimit - used) : 0,
  };
}
export async function requireTripAccess(userId: string, db?: Tx | Database) {
  if (process.env.ENS_SIMULATED === "true") return;
  await requireMember(userId, db);
}
export async function requireMember(userId: string, db?: Tx | Database) {
  const value = await membership(userId, db);
  invariant(
    value.active,
    "MEMBERSHIP_REQUIRED",
    "All Access unlocks every published city and member feature.",
    403,
  );
  return value;
}
