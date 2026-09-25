import { and, eq, or, ne, gt, lte, inArray, desc, asc } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Database, type Tx } from "./db";
import * as s from "./db/schema";
import { applyWrite } from "./db/write";
import { requireMember, membership } from "./membership";
import { invariant } from "./errors";
import { config } from "./config";
import { contactSchema, openContact, sealContact } from "./privacy";
import { publishedCity } from "./catalog";
import { INTERESTS, INTENTS } from "@/lib/constants";
import type { PublicMember, ConnectionItem, NowRecord } from "@/lib/types";
import { tripBadges } from "./ens-world/trips";

export interface MemberExtras {
  tripName: string | null;
  verifiedHuman: boolean;
  now: NowRecord | null;
}
export function publicMember(
  row: s.UserRow,
  ensName: string | null = null,
  extras: Partial<MemberExtras> = {},
): PublicMember {
  return {
    tripName: extras.tripName ?? null,
    verifiedHuman: extras.verifiedHuman ?? false,
    now: extras.now ?? null,
    id: row.id,
    name: row.name,
    role: row.role,
    bio: row.bio,
    interests: row.interests,
    city: row.city,
    neighborhood: row.neighborhood,
    intents: row.intents,
    host: row.host,
    ensName,
    fixture: row.fixture,
  };
}
export async function blockedIds(userId: string, db?: Tx | Database) {
  const rows = await (db ?? (await getDb()))
    .select()
    .from(s.blocks)
    .where(or(eq(s.blocks.actorId, userId), eq(s.blocks.targetId, userId)));
  return new Set(rows.map((row) => (row.actorId === userId ? row.targetId : row.actorId)));
}
async function assertNotBlocked(a: string, b: string, tx?: Tx | Database) {
  invariant(!(await blockedIds(a, tx)).has(b), "NOT_FOUND", "This member is unavailable.", 404);
}
export async function me(user: s.UserRow) {
  const db = await getDb();
  const wallets = await db.select().from(s.walletLinks).where(eq(s.walletLinks.userId, user.id));
  const [contact] = await db
    .select({ id: s.privateContacts.userId })
    .from(s.privateContacts)
    .where(eq(s.privateContacts.userId, user.id));
  const [ens] = await db
    .select()
    .from(s.ensIdentities)
    .where(
      and(
        eq(s.ensIdentities.userId, user.id),
        eq(s.ensIdentities.stale, false),
        gt(s.ensIdentities.verifiedAt, new Date(Date.now() - 300000)),
      ),
    );
  return {
    user: {
      ...publicMember(user, ens?.name ?? null),
      visible: user.visible,
      onboarded: user.onboarded,
      admin: user.admin,
      verifiedHuman: !!user.verifiedHumanAt,
      worldAgentLinked: !!user.worldAgentSub,
    },
    membership: await membership(user.id),
    walletAddresses: wallets.map((row) => row.address),
    hasContact: !!contact,
    demo: config().demo,
  };
}
export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    role: z.string().trim().max(80),
    bio: z.string().trim().max(300),
    interests: z.array(z.enum(INTERESTS)).max(5),
    intents: z.array(z.enum(INTENTS)).max(3),
    neighborhood: z.string().trim().min(1).max(60),
    city: z
      .string()
      .trim()
      .regex(/^[a-z-]+$/)
      .default("tokyo"),
    visible: z.boolean(),
    adult: z.literal(true),
    onboarded: z.boolean().default(true),
  })
  .strict();
export async function updateProfile(userId: string, body: z.infer<typeof profileSchema>) {
  await publishedCity(body.city);
  const { adult: _adult, ...profile } = body;
  await applyWrite(userId, "profile.update", userId, async (tx) => {
    await tx
      .update(s.users)
      .set({
        ...profile,
        interests: [...new Set(profile.interests)],
        intents: [...new Set(profile.intents)],
        updatedAt: new Date(),
      })
      .where(eq(s.users.id, userId));
    if (!profile.visible)
      await tx.update(s.nowPosts).set({ active: false }).where(eq(s.nowPosts.userId, userId));
  });
}
export async function updateContact(userId: string, body: z.infer<typeof contactSchema>) {
  const sealed = await sealContact(userId, { type: body.type, value: body.value });
  await applyWrite(userId, "contact.update", userId, async (tx) => {
    await tx
      .insert(s.privateContacts)
      .values({ userId, sealed, shareOnAcceptance: body.shareOnAcceptance })
      .onConflictDoUpdate({
        target: s.privateContacts.userId,
        set: { sealed, shareOnAcceptance: body.shareOnAcceptance, updatedAt: new Date() },
      });
  });
}
export async function listMembers(actorId: string, params: URLSearchParams) {
  invariant(
    config().directoryEnabled,
    "FEATURE_PAUSED",
    "Member discovery is temporarily paused.",
    503,
  );
  await requireMember(actorId);
  const db = await getDb(),
    blocked = await blockedIds(actorId),
    city = params.get("city") ?? "tokyo";
  const rows = await db
    .select()
    .from(s.users)
    .where(
      and(
        eq(s.users.visible, true),
        eq(s.users.suspended, false),
        ne(s.users.id, actorId),
        city === "all" ? undefined : eq(s.users.city, city),
      ),
    )
    .orderBy(asc(s.users.name))
    .limit(100);
  const query = params.get("q")?.toLowerCase().slice(0, 80) ?? "";
  // ENS labels appear only after a recent real verification. Never fabricate demo names.
  const ensRows = await db
    .select()
    .from(s.ensIdentities)
    .where(
      and(
        eq(s.ensIdentities.stale, false),
        gt(s.ensIdentities.verifiedAt, new Date(Date.now() - 300000)),
      ),
    );
  const shown = rows
    .filter(
      (row) =>
        !blocked.has(row.id) &&
        (!query ||
          (row.name + " " + row.role + " " + row.interests.join(" "))
            .toLowerCase()
            .includes(query)),
    )
    .slice(0, 50);
  // Trip names and verified-human badges come from the ENSv2 trips, never fabricated.
  const badges = await tripBadges(
    shown.map((row) => row.id),
    city === "all" ? undefined : city,
  );
  return shown.map((row) =>
    publicMember(
      row,
      ensRows.find((ens) => ens.userId === row.id)?.name ?? null,
      badges.get(row.id),
    ),
  );
}
export async function memberDetail(actorId: string, memberId: string) {
  await requireMember(actorId);
  await assertNotBlocked(actorId, memberId);
  const [row] = await (
    await getDb()
  )
    .select()
    .from(s.users)
    .where(and(eq(s.users.id, memberId), eq(s.users.visible, true), eq(s.users.suspended, false)))
    .limit(1);
  invariant(row, "NOT_FOUND", "Member not found.", 404);
  return publicMember(row, null, (await tripBadges([row.id])).get(row.id));
}
export const requestSchema = z
  .object({
    recipientId: z.string().uuid(),
    context: z.string().trim().min(5).max(280),
    nowPostId: z.string().uuid().optional(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export async function createRequest(actorId: string, body: z.infer<typeof requestSchema>) {
  invariant(actorId !== body.recipientId, "SELF_REQUEST", "You cannot request yourself.", 422);
  return applyWrite(actorId, "request.create", body.recipientId, async (tx) => {
    // Lock both user rows in a stable order: quota checks, reciprocal requests and blocks serialize.
    await tx
      .select({ id: s.users.id })
      .from(s.users)
      .where(inArray(s.users.id, [actorId, body.recipientId].sort()))
      .orderBy(asc(s.users.id))
      .for("update");
    const [existing] = await tx
      .select()
      .from(s.connectionRequests)
      .where(
        and(
          eq(s.connectionRequests.senderId, actorId),
          eq(s.connectionRequests.idempotencyKey, body.idempotencyKey),
        ),
      );
    if (existing) return existing;
    const paid = await requireMember(actorId, tx);
    invariant(
      paid.remainingRequests > 0,
      "QUOTA_EXHAUSTED",
      "You have used this period's 10 connection requests.",
      429,
    );
    await assertNotBlocked(actorId, body.recipientId, tx);
    const [recipient] = await tx
      .select()
      .from(s.users)
      .where(
        and(
          eq(s.users.id, body.recipientId),
          eq(s.users.visible, true),
          eq(s.users.suspended, false),
        ),
      );
    invariant(recipient, "NOT_FOUND", "Member not found.", 404);
    const [sender] = await tx.select().from(s.users).where(eq(s.users.id, actorId));
    invariant(sender && !sender.suspended, "FORBIDDEN", "This account is unavailable.", 403);
    if (body.nowPostId) {
      const [post] = await tx
        .select()
        .from(s.nowPosts)
        .where(
          and(
            eq(s.nowPosts.id, body.nowPostId),
            eq(s.nowPosts.userId, body.recipientId),
            eq(s.nowPosts.active, true),
            gt(s.nowPosts.expiresAt, new Date()),
          ),
        );
      invariant(post, "INVITATION_EXPIRED", "This invitation is no longer available.", 409);
    }
    const [low, high] = [actorId, body.recipientId].sort();
    const [connected] = await tx
      .select()
      .from(s.connections)
      .where(and(eq(s.connections.lowUserId, low), eq(s.connections.highUserId, high)));
    invariant(
      !connected,
      "ALREADY_CONNECTED",
      "You are already connected. Open your requests to see shared contacts.",
      409,
    );
    const pair = or(
      and(
        eq(s.connectionRequests.senderId, actorId),
        eq(s.connectionRequests.recipientId, body.recipientId),
      ),
      and(
        eq(s.connectionRequests.senderId, body.recipientId),
        eq(s.connectionRequests.recipientId, actorId),
      ),
    );
    const [pending] = await tx
      .select()
      .from(s.connectionRequests)
      .where(
        and(
          pair,
          eq(s.connectionRequests.status, "pending"),
          gt(s.connectionRequests.expiresAt, new Date()),
        ),
      );
    invariant(
      !pending,
      "REQUEST_EXISTS",
      "A connection request is already pending between you.",
      409,
    );
    return (
      await tx
        .insert(s.connectionRequests)
        .values({
          senderId: actorId,
          recipientId: body.recipientId,
          context: body.context,
          nowPostId: body.nowPostId,
          idempotencyKey: body.idempotencyKey,
          entitlementId: paid.current!.id,
          expiresAt: new Date(Date.now() + 7 * 86400000),
        })
        .returning()
    )[0];
  });
}
export async function respondRequest(
  actorId: string,
  requestId: string,
  action: "accept" | "decline" | "cancel",
) {
  const db = await getDb();
  const [observed] = await db
    .select()
    .from(s.connectionRequests)
    .where(eq(s.connectionRequests.id, requestId));
  invariant(
    observed && [observed.senderId, observed.recipientId].includes(actorId),
    "NOT_FOUND",
    "Request not found.",
    404,
  );
  return applyWrite(actorId, "request." + action, requestId, (tx) =>
    respondRequestIn(tx, actorId, requestId, action, observed),
  );
}
/** The body of respondRequest inside a caller-owned transaction (agent approvals run executors this way). */
export async function respondRequestIn(
  tx: Tx,
  actorId: string,
  requestId: string,
  action: "accept" | "decline" | "cancel",
  observed?: typeof s.connectionRequests.$inferSelect,
) {
  if (!observed) {
    [observed] = await tx
      .select()
      .from(s.connectionRequests)
      .where(eq(s.connectionRequests.id, requestId));
    invariant(
      observed && [observed.senderId, observed.recipientId].includes(actorId),
      "NOT_FOUND",
      "Request not found.",
      404,
    );
  }
  {
    await tx
      .select({ id: s.users.id })
      .from(s.users)
      .where(inArray(s.users.id, [observed.senderId, observed.recipientId].sort()))
      .orderBy(asc(s.users.id))
      .for("update");
    const [row] = await tx
      .select()
      .from(s.connectionRequests)
      .where(eq(s.connectionRequests.id, requestId))
      .for("update");
    invariant(
      action === "cancel" ? row.senderId === actorId : row.recipientId === actorId,
      "FORBIDDEN",
      "You cannot perform that action.",
      403,
    );
    const desired =
      action === "accept" ? "accepted" : action === "decline" ? "declined" : "cancelled";
    if (row.status === desired) return { status: desired };
    invariant(
      row.status === "pending" && row.expiresAt > new Date(),
      "REQUEST_CLOSED",
      "This request is no longer pending.",
      409,
    );
    await assertNotBlocked(row.senderId, row.recipientId, tx);
    const [other] = await tx
      .select()
      .from(s.users)
      .where(eq(s.users.id, row.senderId === actorId ? row.recipientId : row.senderId));
    invariant(other && !other.suspended, "NOT_FOUND", "Member unavailable.", 404);
    await tx
      .update(s.connectionRequests)
      .set({ status: desired })
      .where(eq(s.connectionRequests.id, requestId));
    if (action === "accept") {
      const [low, high] = [row.senderId, row.recipientId].sort();
      await tx
        .insert(s.connections)
        .values({ lowUserId: low, highUserId: high })
        .onConflictDoNothing();
    }
    return { status: desired };
  }
}
export async function listRequests(actorId: string): Promise<ConnectionItem[]> {
  const db = await getDb(),
    blocked = await blockedIds(actorId);
  const rows = await db
    .select()
    .from(s.connectionRequests)
    .where(
      or(eq(s.connectionRequests.senderId, actorId), eq(s.connectionRequests.recipientId, actorId)),
    )
    .orderBy(desc(s.connectionRequests.createdAt))
    .limit(100);
  const result: ConnectionItem[] = [];
  for (const row of rows) {
    const otherId = row.senderId === actorId ? row.recipientId : row.senderId;
    if (blocked.has(otherId)) continue;
    const [other] = await db
      .select()
      .from(s.users)
      .where(and(eq(s.users.id, otherId), eq(s.users.suspended, false)));
    if (!other) continue;
    let contact: { type: string; value: string } | null = null;
    if (row.status === "accepted") {
      const [low, high] = [actorId, otherId].sort();
      const [connection] = await db
        .select()
        .from(s.connections)
        .where(and(eq(s.connections.lowUserId, low), eq(s.connections.highUserId, high)));
      if (connection) {
        const [privateRow] = await db
          .select()
          .from(s.privateContacts)
          .where(
            and(
              eq(s.privateContacts.userId, otherId),
              eq(s.privateContacts.shareOnAcceptance, true),
            ),
          );
        if (privateRow) contact = await openContact(otherId, privateRow.sealed);
      }
    }
    result.push({
      id: row.id,
      direction: row.recipientId === actorId ? "incoming" : "outgoing",
      status: row.status === "pending" && row.expiresAt <= new Date() ? "expired" : row.status,
      context: row.context,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      member: publicMember(other),
      contact,
    });
  }
  return result;
}
export const nowSchema = z
  .object({
    kind: z.enum(INTENTS),
    neighborhood: z.string().trim().min(1).max(60),
    city: z.string().default("tokyo"),
    note: z.string().trim().min(5).max(140),
    hours: z.number().int().min(1).max(6),
    placeId: z.string().uuid().optional(),
  })
  .strict();
export async function createNow(actorId: string, body: z.infer<typeof nowSchema>) {
  invariant(config().nowEnabled, "FEATURE_PAUSED", "Right now is temporarily paused.", 503);
  await publishedCity(body.city);
  return applyWrite(actorId, "now.create", actorId, (tx) => createNowIn(tx, actorId, body));
}
/** The body of createNow inside a caller-owned transaction (the concierge posts through an approval). */
export async function createNowIn(tx: Tx, actorId: string, body: z.infer<typeof nowSchema>) {
  {
    const [owner] = await tx.select().from(s.users).where(eq(s.users.id, actorId)).for("update");
    await requireMember(actorId, tx);
    invariant(
      owner.visible,
      "PROFILE_PRIVATE",
      "Make your profile discoverable before posting an invitation.",
      409,
    );
    if (body.placeId) {
      const [place] = await tx
        .select()
        .from(s.places)
        .where(
          and(
            eq(s.places.id, body.placeId),
            eq(s.places.city, body.city),
            eq(s.places.published, true),
          ),
        );
      invariant(place, "NOT_FOUND", "Choose a published place in this city.", 404);
    }
    await tx.update(s.nowPosts).set({ active: false }).where(eq(s.nowPosts.userId, actorId));
    const now = new Date();
    return (
      await tx
        .insert(s.nowPosts)
        .values({
          userId: actorId,
          city: body.city,
          kind: body.kind,
          neighborhood: body.neighborhood,
          note: body.note,
          placeId: body.placeId,
          startsAt: now,
          expiresAt: new Date(now.getTime() + body.hours * 3600000),
        })
        .returning()
    )[0];
  }
}
export async function listNow(actorId: string, city = "tokyo") {
  invariant(config().nowEnabled, "FEATURE_PAUSED", "Right now is temporarily paused.", 503);
  await requireMember(actorId);
  await publishedCity(city);
  const db = await getDb(),
    blocked = await blockedIds(actorId);
  const rows = await db
    .select({ post: s.nowPosts, user: s.users, place: { id: s.places.id, name: s.places.name } })
    .from(s.nowPosts)
    .innerJoin(s.users, eq(s.nowPosts.userId, s.users.id))
    .leftJoin(s.places, eq(s.nowPosts.placeId, s.places.id))
    .where(
      and(
        eq(s.nowPosts.city, city),
        eq(s.nowPosts.active, true),
        gt(s.nowPosts.expiresAt, new Date()),
        eq(s.users.visible, true),
        eq(s.users.suspended, false),
      ),
    )
    .orderBy(asc(s.nowPosts.expiresAt))
    .limit(60);
  return rows
    .filter((row) => !blocked.has(row.user.id))
    .map(({ post, user, place }) => ({
      id: post.id,
      kind: post.kind,
      neighborhood: post.neighborhood,
      note: post.note,
      startsAt: post.startsAt.toISOString(),
      expiresAt: post.expiresAt.toISOString(),
      owner: publicMember(user),
      place,
      own: post.userId === actorId,
    }));
}
export async function cancelNow(actorId: string, id: string) {
  await applyWrite(actorId, "now.cancel", id, async (tx) => {
    const updated = await tx
      .update(s.nowPosts)
      .set({ active: false })
      .where(and(eq(s.nowPosts.id, id), eq(s.nowPosts.userId, actorId)))
      .returning({ id: s.nowPosts.id });
    invariant(updated.length, "NOT_FOUND", "Invitation not found.", 404);
  });
}
export async function blockMember(actorId: string, targetId: string) {
  invariant(actorId !== targetId, "SELF_BLOCK", "You cannot block yourself.", 422);
  await applyWrite(actorId, "member.block", targetId, async (tx) => {
    const accounts = await tx
      .select({ id: s.users.id })
      .from(s.users)
      .where(inArray(s.users.id, [actorId, targetId].sort()))
      .orderBy(asc(s.users.id))
      .for("update");
    invariant(accounts.length === 2, "NOT_FOUND", "Member not found.", 404);
    await tx.insert(s.blocks).values({ actorId, targetId }).onConflictDoNothing();
  });
}

export async function listOwnBlocks(actorId: string) {
  const db = await getDb();
  return db
    .select({ targetId: s.blocks.targetId, name: s.users.name, createdAt: s.blocks.createdAt })
    .from(s.blocks)
    .innerJoin(s.users, eq(s.blocks.targetId, s.users.id))
    .where(eq(s.blocks.actorId, actorId))
    .limit(100);
}
export async function unblockMember(actorId: string, targetId: string) {
  await applyWrite(actorId, "member.unblock", targetId, async (tx) => {
    await tx
      .select({ id: s.users.id })
      .from(s.users)
      .where(inArray(s.users.id, [actorId, targetId].sort()))
      .orderBy(asc(s.users.id))
      .for("update");
    await tx
      .delete(s.blocks)
      .where(and(eq(s.blocks.actorId, actorId), eq(s.blocks.targetId, targetId)));
  });
}
export async function removeContact(actorId: string) {
  await applyWrite(actorId, "contact.remove", actorId, async (tx) => {
    await tx.delete(s.privateContacts).where(eq(s.privateContacts.userId, actorId));
  });
}
