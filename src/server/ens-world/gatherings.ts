import { randomBytes } from "node:crypto";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Database, type Tx } from "@/server/db";
import * as s from "@/server/db/schema";
import { applyWrite } from "@/server/db/write";
import { invariant } from "@/server/errors";
import { uuid } from "@/server/config";
import { requireTripAccess } from "@/server/membership";
import { publishedCity } from "@/server/catalog";
import { blockedIds } from "@/server/social";
import { chain } from "@/server/ens-v2/chain";
import { explorerName, explorerTx } from "@/server/ens-v2/addresses";
import { tableLabel, tableName } from "@/server/ens-v2/names";
import { enqueueEnsJob, registerEnsJobHandler } from "@/server/ens-v2/jobs";
import { registerApprovalExecutor, requestApproval } from "@/server/world/approvals";
import { activeTripFor, tickEnsWorld, writeRecordsProven } from "./trips";
import { computeShares, usdcBaseUnits } from "./split";
import { splitNetwork } from "@/server/splits/settlement";
import type {
  ApprovalDTO,
  AttendeeDTO,
  GatheringDetail,
  GatheringKind,
  GatheringSummary,
} from "@/lib/types";

export const GATHERING_KINDS = ["coffee", "breakfast", "lunch", "dinner", "drinks"] as const;
const LISTED_STATUSES = ["open", "full", "closed"] as const;
const RECORD_TTL_MS = 6 * 3600000;
export const createGatheringSchema = z
  .object({
    city: z
      .string()
      .regex(/^[a-z-]+$/)
      .default("tokyo"),
    kind: z.enum(GATHERING_KINDS),
    placeId: z.string().uuid().optional(),
    area: z.string().trim().min(1).max(60),
    startsAt: z.iso.datetime({ offset: true }),
    seats: z.number().int().min(2).max(8),
  })
  .strict();
export const seatRequestSchema = z
  .object({ plusOnes: z.number().int().min(0).max(1).default(0) })
  .strict();
export const attendeeSchema = z.object({ attendeeId: uuid }).strict();

export const seatsTaken = (attendees: { status: string; plusOnes: number }[]) =>
  attendees
    .filter((row) => row.status === "approved")
    .reduce((total, row) => total + 1 + row.plusOnes, 0);
const dateLabel = (value: Date) =>
  new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(value) + " JST";

async function loadGathering(id: string, db?: Tx | Database, lock = false) {
  const query = (db ?? (await getDb())).select().from(s.gatherings).where(eq(s.gatherings.id, id));
  const [row] = await (lock ? query.for("update") : query);
  invariant(row, "NOT_FOUND", "Table not found.", 404);
  return row;
}
async function attendeesOf(gatheringId: string, db?: Tx | Database) {
  return (db ?? (await getDb()))
    .select({
      attendee: s.gatheringAttendees,
      tripName: s.trips.ensName,
      displayName: s.users.name,
      verifiedHumanAt: s.users.verifiedHumanAt,
    })
    .from(s.gatheringAttendees)
    .innerJoin(s.trips, eq(s.gatheringAttendees.tripId, s.trips.id))
    .innerJoin(s.users, eq(s.gatheringAttendees.userId, s.users.id))
    .where(eq(s.gatheringAttendees.gatheringId, gatheringId))
    .orderBy(asc(s.gatheringAttendees.createdAt));
}
/** A member may host or join only with an active trip in the city and a verified human badge. */
async function requirePresence(user: s.UserRow, city: string, db?: Tx | Database) {
  const trip = await activeTripFor(user.id, city, db);
  invariant(trip, "TRIP_REQUIRED", "Activate a trip in this city first.", 403);
  invariant(user.verifiedHumanAt, "HUMAN_REQUIRED", "Verify with World ID first.", 403);
  return trip;
}
/** The JSON written to friendship.table: names only, never account ids or wallets. */
export async function tableRecord(gatheringId: string, db?: Tx | Database): Promise<string> {
  const store = db ?? (await getDb());
  const gathering = await loadGathering(gatheringId, store);
  const rows = await attendeesOf(gatheringId, store);
  const approved = rows.filter((row) => row.attendee.status === "approved");
  const host = rows.find((row) => row.attendee.role === "host");
  const [place] = gathering.placeId
    ? await store.select().from(s.places).where(eq(s.places.id, gathering.placeId))
    : [];
  return JSON.stringify({
    v: 1,
    kind: gathering.kind,
    place: place?.slug ?? null,
    area: gathering.area,
    startsAt: Math.floor(gathering.startsAt.getTime() / 1000),
    seats: gathering.seats,
    host: host?.tripName ?? null,
    attendees: approved.map((row) => row.tripName),
    guests: approved.reduce((total, row) => total + row.attendee.plusOnes, 0),
    status: gathering.status,
    expiresAt: Math.floor((gathering.startsAt.getTime() + RECORD_TTL_MS) / 1000),
  });
}
async function summaries(
  user: s.UserRow | null,
  rows: s.GatheringRow[],
  db: Database,
): Promise<GatheringSummary[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const attendees = await db
    .select({ attendee: s.gatheringAttendees })
    .from(s.gatheringAttendees)
    .where(inArray(s.gatheringAttendees.gatheringId, ids));
  const hosts = await db
    .select({ id: s.users.id, name: s.users.name, verifiedHumanAt: s.users.verifiedHumanAt })
    .from(s.users)
    .where(
      inArray(
        s.users.id,
        rows.map((row) => row.hostUserId),
      ),
    );
  const hostTrips = await db
    .select({ id: s.trips.id, ensName: s.trips.ensName })
    .from(s.trips)
    .where(
      inArray(
        s.trips.id,
        rows.map((row) => row.tripId),
      ),
    );
  const placeIds = rows.map((row) => row.placeId).filter((id): id is string => !!id);
  const places = placeIds.length
    ? await db.select().from(s.places).where(inArray(s.places.id, placeIds))
    : [];
  return rows.map((row) => {
    const mine = attendees.filter((item) => item.attendee.gatheringId === row.id);
    const host = hosts.find((item) => item.id === row.hostUserId);
    const own = user ? mine.find((item) => item.attendee.userId === user.id) : undefined;
    const place = places.find((item) => item.id === row.placeId);
    return {
      id: row.id,
      city: row.city,
      kind: row.kind,
      area: row.area,
      place: place ? { id: place.id, slug: place.slug, name: place.name } : null,
      startsAt: row.startsAt.toISOString(),
      seats: row.seats,
      seatsLeft: Math.max(0, row.seats - seatsTaken(mine.map((item) => item.attendee))),
      status: row.status,
      label: row.label,
      name: row.ensName,
      host: {
        name: hostTrips.find((item) => item.id === row.tripId)?.ensName ?? "",
        displayName: host?.name ?? "",
        verifiedHuman: !!host?.verifiedHumanAt,
      },
      chainRecordTx: row.chainRecordTx,
      chainVerifiedAt: row.chainVerifiedAt?.toISOString() ?? null,
      mine: !!user && row.hostUserId === user.id,
      myStatus: own?.attendee.status ?? null,
      explorer: { name: explorerName(row.ensName), tx: explorerTx(row.chainRecordTx) },
    };
  });
}
export async function listGatherings(user: s.UserRow | null, city: string) {
  await publishedCity(city);
  if (user) await requireTripAccess(user.id);
  await tickEnsWorld();
  const db = await getDb();
  const blocked = user ? await blockedIds(user.id) : new Set<string>();
  const rows = await db
    .select()
    .from(s.gatherings)
    .where(
      and(
        eq(s.gatherings.city, city),
        inArray(s.gatherings.status, [...LISTED_STATUSES]),
        gte(s.gatherings.startsAt, new Date(Date.now() - RECORD_TTL_MS)),
      ),
    )
    .orderBy(asc(s.gatherings.startsAt))
    .limit(60);
  return summaries(
    user,
    rows.filter((row) => !blocked.has(row.hostUserId)),
    db,
  );
}
export async function gatheringDetail(
  user: s.UserRow | null,
  id: string,
): Promise<GatheringDetail> {
  await tickEnsWorld();
  const db = await getDb();
  const row = await loadGathering(id, db);
  if (user) {
    await requireTripAccess(user.id);
    invariant(
      !(await blockedIds(user.id)).has(row.hostUserId),
      "NOT_FOUND",
      "Table not found.",
      404,
    );
  }
  const [summary] = await summaries(user, [row], db);
  const rows = await attendeesOf(id, db);
  const attendees: AttendeeDTO[] = rows
    .filter((item) => item.attendee.status !== "declined" || item.attendee.userId === user?.id)
    .map((item) => ({
      id: item.attendee.id,
      name: item.tripName,
      displayName: item.displayName,
      role: item.attendee.role,
      plusOnes: item.attendee.plusOnes,
      status: item.attendee.status,
      verifiedHuman: !!item.verifiedHumanAt,
      shareCents: item.attendee.shareCents,
      paidTx: item.attendee.paidTx,
      paidVerifiedAt: item.attendee.paidVerifiedAt?.toISOString() ?? null,
    }));
  const approved = rows.filter((item) => item.attendee.status === "approved");
  const own = rows.find((item) => item.attendee.userId === user?.id);
  const hostRow = rows.find((item) => item.attendee.role === "host");
  const shares =
    row.splitStatus !== "none" && row.splitTotalCents != null
      ? computeShares({
          totalCents: row.splitTotalCents,
          members: approved.map((item) => ({
            id: item.attendee.userId,
            plusOnes: item.attendee.plusOnes,
          })),
          hostId: row.hostUserId,
        })
      : null;
  const mine =
    own &&
    own.attendee.role === "member" &&
    own.attendee.shareCents != null &&
    own.attendee.payAddress
      ? {
          shareCents: own.attendee.shareCents,
          payTo: own.attendee.payAddress,
          payToName: hostRow?.tripName ?? "",
          token: row.splitToken ?? "",
          chainId: row.splitChainId,
          chainName:
            row.splitChainId != null ? splitNetwork(row.splitChainId).name : "Requires review",
          payer: own.attendee.splitPayer,
          errorCode: own.attendee.splitErrorCode,
          explorerTx:
            row.splitChainId && own.attendee.paidTx
              ? splitNetwork(row.splitChainId).explorer + "/tx/" + own.attendee.paidTx
              : null,
          amountBaseUnits: usdcBaseUnits(own.attendee.shareCents).toString(),
          paidTx: own.attendee.paidTx,
          verified: !!own.attendee.paidVerifiedAt,
        }
      : null;
  let record: string | null = null;
  try {
    record = await chain().readText(row.ensName, "friendship.table");
  } catch {
    record = null;
  }
  return {
    ...summary,
    attendees,
    guests: approved.reduce((total, item) => total + item.attendee.plusOnes, 0),
    split: {
      status: row.splitStatus,
      totalCents: row.splitTotalCents,
      unitCents: shares?.unitCents ?? null,
      hostCents: shares?.hostCents ?? null,
      mine,
    },
    record,
  };
}
export async function createGathering(
  host: s.UserRow,
  body: z.infer<typeof createGatheringSchema>,
): Promise<GatheringDetail> {
  await requireTripAccess(host.id);
  await publishedCity(body.city);
  const trip = await requirePresence(host, body.city);
  const startsAt = new Date(body.startsAt);
  invariant(
    startsAt.getTime() >= Date.now() - 3600000 && startsAt.getTime() <= Date.now() + 14 * 86400000,
    "TABLE_TIME",
    "Tables start within the next two weeks.",
    422,
  );
  const db = await getDb();
  if (body.placeId) {
    const [place] = await db
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
  const id = await applyWrite(host.id, "table.create", body.city, async (tx) => {
    const taken = new Set(
      (
        await tx
          .select({ label: s.gatherings.label })
          .from(s.gatherings)
          .where(eq(s.gatherings.city, body.city))
      ).map((row) => row.label),
    );
    let label = tableLabel(body.kind, startsAt);
    while (taken.has(label))
      label = tableLabel(body.kind, startsAt, randomBytes(2).toString("hex"));
    const [row] = await tx
      .insert(s.gatherings)
      .values({
        hostUserId: host.id,
        tripId: trip.id,
        city: body.city,
        kind: body.kind,
        placeId: body.placeId ?? null,
        area: body.area,
        startsAt,
        seats: body.seats,
        label,
        ensName: tableName(body.city, label),
      })
      .returning();
    await tx.insert(s.gatheringAttendees).values({
      gatheringId: row.id,
      userId: host.id,
      tripId: trip.id,
      role: "host",
      plusOnes: 0,
      status: "approved",
    });
    await enqueueEnsJob(tx, { kind: "table.write", signer: "concierge", entityId: row.id });
    return row.id;
  });
  await tickEnsWorld();
  return gatheringDetail(host, id);
}
async function assertSeatAvailable(gathering: s.GatheringRow, plusOnes: number, db: Tx | Database) {
  invariant(
    gathering.splitStatus === "none",
    "SPLIT_FROZEN",
    "The bill has been split; the attendee list is fixed.",
    409,
  );
  invariant(gathering.status === "open", "TABLE_CLOSED", "This table is not taking requests.", 409);
  const rows = await db
    .select()
    .from(s.gatheringAttendees)
    .where(eq(s.gatheringAttendees.gatheringId, gathering.id));
  invariant(
    seatsTaken(rows) + 1 + plusOnes <= gathering.seats,
    "TABLE_FULL",
    "Not enough seats left at this table.",
    409,
  );
  return rows;
}
export async function requestSeat(
  user: s.UserRow,
  gatheringId: string,
  body: z.infer<typeof seatRequestSchema>,
): Promise<ApprovalDTO> {
  await requireTripAccess(user.id);
  const db = await getDb();
  const gathering = await loadGathering(gatheringId, db);
  invariant(gathering.hostUserId !== user.id, "SELF_REQUEST", "You are hosting this table.", 422);
  await requirePresence(user, gathering.city, db);
  invariant(
    !(await blockedIds(user.id)).has(gathering.hostUserId),
    "NOT_FOUND",
    "Table not found.",
    404,
  );
  const rows = await assertSeatAvailable(gathering, body.plusOnes, db);
  const existing = rows.find((row) => row.userId === user.id);
  invariant(
    !existing || existing.status === "left",
    existing?.status === "declined" ? "REQUEST_CLOSED" : "REQUEST_EXISTS",
    existing?.status === "declined"
      ? "The host declined your request."
      : "You already asked to join this table.",
    409,
  );
  const [host] = await db.select().from(s.users).where(eq(s.users.id, gathering.hostUserId));
  return requestApproval(user, {
    action: "table.request",
    payload: { gatheringId, plusOnes: body.plusOnes },
    summary:
      "Ask to join " +
      (host?.name ?? "the host") +
      "'s " +
      gathering.kind +
      " " +
      dateLabel(gathering.startsAt) +
      (body.plusOnes ? " with a plus-one" : ""),
  });
}
registerApprovalExecutor("table.request", async (tx, approval, user) => {
  const payload = z
    .object({ gatheringId: uuid, plusOnes: z.number().int().min(0).max(1) })
    .parse(approval.payload);
  const gathering = await loadGathering(payload.gatheringId, tx, true);
  const trip = await requirePresence(user, gathering.city, tx);
  invariant(
    !(await blockedIds(user.id, tx)).has(gathering.hostUserId),
    "NOT_FOUND",
    "Table not found.",
    404,
  );
  const rows = await assertSeatAvailable(gathering, payload.plusOnes, tx);
  const existing = rows.find((row) => row.userId === user.id);
  invariant(!existing || existing.status === "left", "REQUEST_EXISTS", "Already requested.", 409);
  const values = {
    tripId: trip.id,
    plusOnes: payload.plusOnes,
    status: "requested" as const,
    approvalId: approval.id,
    updatedAt: new Date(),
  };
  if (existing) {
    await tx
      .update(s.gatheringAttendees)
      .set(values)
      .where(eq(s.gatheringAttendees.id, existing.id));
    return existing.id;
  }
  const [row] = await tx
    .insert(s.gatheringAttendees)
    .values({ gatheringId: gathering.id, userId: user.id, role: "member", ...values })
    .returning({ id: s.gatheringAttendees.id });
  return row.id;
});
async function hostAttendee(
  host: s.UserRow,
  gatheringId: string,
  attendeeId: string,
  db: Tx | Database,
) {
  const gathering = await loadGathering(gatheringId, db, true);
  invariant(gathering.hostUserId === host.id, "FORBIDDEN", "Only the host can do that.", 403);
  const [attendee] = await db
    .select()
    .from(s.gatheringAttendees)
    .where(
      and(
        eq(s.gatheringAttendees.id, attendeeId),
        eq(s.gatheringAttendees.gatheringId, gatheringId),
      ),
    );
  invariant(attendee && attendee.role === "member", "NOT_FOUND", "Request not found.", 404);
  return { gathering, attendee };
}
export async function approveSeat(
  host: s.UserRow,
  gatheringId: string,
  body: z.infer<typeof attendeeSchema>,
): Promise<ApprovalDTO> {
  const db = await getDb();
  const { gathering, attendee } = await hostAttendee(host, gatheringId, body.attendeeId, db);
  invariant(attendee.status === "requested", "REQUEST_CLOSED", "This request is not pending.", 409);
  const [member] = await db.select().from(s.users).where(eq(s.users.id, attendee.userId));
  return requestApproval(host, {
    action: "table.approve",
    payload: { gatheringId, attendeeId: attendee.id },
    summary:
      "Approve " +
      (member?.name ?? "a member") +
      (attendee.plusOnes ? " and a plus-one" : "") +
      " for your " +
      gathering.kind +
      " " +
      dateLabel(gathering.startsAt),
  });
}
registerApprovalExecutor("table.approve", async (tx, approval, host) => {
  const payload = z.object({ gatheringId: uuid, attendeeId: uuid }).parse(approval.payload);
  const { gathering, attendee } = await hostAttendee(
    host,
    payload.gatheringId,
    payload.attendeeId,
    tx,
  );
  invariant(attendee.status === "requested", "REQUEST_CLOSED", "This request is not pending.", 409);
  const rows = await assertSeatAvailable(gathering, attendee.plusOnes, tx);
  await tx
    .update(s.gatheringAttendees)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(s.gatheringAttendees.id, attendee.id));
  const taken = seatsTaken(rows) + 1 + attendee.plusOnes;
  await tx
    .update(s.gatherings)
    .set({ status: taken >= gathering.seats ? "full" : "open", updatedAt: new Date() })
    .where(eq(s.gatherings.id, gathering.id));
  await enqueueEnsJob(tx, { kind: "table.write", signer: "concierge", entityId: gathering.id });
  return attendee.id;
});
export async function declineSeat(
  host: s.UserRow,
  gatheringId: string,
  body: z.infer<typeof attendeeSchema>,
) {
  await applyWrite(host.id, "table.decline", gatheringId, async (tx) => {
    const { attendee } = await hostAttendee(host, gatheringId, body.attendeeId, tx);
    invariant(
      attendee.status === "requested",
      "REQUEST_CLOSED",
      "This request is not pending.",
      409,
    );
    await tx
      .update(s.gatheringAttendees)
      .set({ status: "declined", updatedAt: new Date() })
      .where(eq(s.gatheringAttendees.id, attendee.id));
  });
  return gatheringDetail(host, gatheringId);
}
export async function leaveGathering(user: s.UserRow, gatheringId: string) {
  await applyWrite(user.id, "table.leave", gatheringId, async (tx) => {
    const gathering = await loadGathering(gatheringId, tx, true);
    invariant(
      gathering.splitStatus === "none",
      "SPLIT_FROZEN",
      "The bill has been split; the attendee list is fixed.",
      409,
    );
    const [attendee] = await tx
      .select()
      .from(s.gatheringAttendees)
      .where(
        and(
          eq(s.gatheringAttendees.gatheringId, gatheringId),
          eq(s.gatheringAttendees.userId, user.id),
        ),
      );
    invariant(
      attendee && attendee.role === "member" && ["requested", "approved"].includes(attendee.status),
      "NOT_FOUND",
      "You are not at this table.",
      404,
    );
    await tx
      .update(s.gatheringAttendees)
      .set({ status: "left", updatedAt: new Date() })
      .where(eq(s.gatheringAttendees.id, attendee.id));
    if (attendee.status === "approved") {
      if (gathering.status === "full")
        await tx
          .update(s.gatherings)
          .set({ status: "open", updatedAt: new Date() })
          .where(eq(s.gatherings.id, gathering.id));
      await enqueueEnsJob(tx, { kind: "table.write", signer: "concierge", entityId: gathering.id });
    }
  });
  await tickEnsWorld();
  return gatheringDetail(user, gatheringId);
}
async function setStatus(host: s.UserRow, gatheringId: string, status: "closed" | "cancelled") {
  await applyWrite(host.id, "table." + status, gatheringId, async (tx) => {
    const gathering = await loadGathering(gatheringId, tx, true);
    invariant(
      gathering.splitStatus === "none",
      "SPLIT_FROZEN",
      "The bill has been split; this table cannot be cancelled or reopened.",
      409,
    );
    invariant(gathering.hostUserId === host.id, "FORBIDDEN", "Only the host can do that.", 403);
    invariant(gathering.status !== "cancelled", "TABLE_CLOSED", "This table was cancelled.", 409);
    await tx
      .update(s.gatherings)
      .set({ status, updatedAt: new Date() })
      .where(eq(s.gatherings.id, gathering.id));
    await enqueueEnsJob(tx, { kind: "table.write", signer: "concierge", entityId: gathering.id });
  });
  await tickEnsWorld();
  return gatheringDetail(host, gatheringId);
}
export const closeGathering = (host: s.UserRow, id: string) => setStatus(host, id, "closed");
export const cancelGathering = (host: s.UserRow, id: string) => setStatus(host, id, "cancelled");
registerEnsJobHandler("table.write", async (job) => {
  const gathering = await loadGathering(job.entityId);
  const stale =
    gathering.status === "closed" && Date.now() - gathering.updatedAt.getTime() > 24 * 3600000;
  const value = gathering.status === "cancelled" || stale ? "" : await tableRecord(gathering.id);
  const submission = await writeRecordsProven("concierge", gathering.ensName, [
    { type: "text", key: "friendship.table", value },
  ]);
  await applyWrite(null, "table.recorded", gathering.id, async (tx) => {
    await tx
      .update(s.gatherings)
      .set({ chainRecordTx: submission.hash, chainVerifiedAt: new Date() })
      .where(eq(s.gatherings.id, gathering.id));
  });
  return { txHash: submission.hash };
});
export type { GatheringKind };
