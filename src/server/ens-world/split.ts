import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import * as s from "@/server/db/schema";
import { applyWrite } from "@/server/db/write";
import { AppError, invariant } from "@/server/errors";
import { isDemo, txHash } from "@/server/config";
import { requireMember } from "@/server/membership";
import { chain } from "@/server/ens-v2/chain";
import { ETH_COIN_TYPE } from "@/server/ens-v2/addresses";
import { enqueueEnsJob, registerEnsJobHandler } from "@/server/ens-v2/jobs";
import { tickEnsWorld } from "./trips";

/**
 * Splitting the bill: equal shares across the people at the table, plus-ones included in the
 * head count but paid by the host (a plus-one has no name to resolve). Members pay the host's
 * address, resolved fresh from the host's trip name when the split starts, in MockUSDC on
 * Sepolia (6 decimals, so 1 cent is 10^4 base units). A reported hash is a hint; the worker
 * reads the transfer from the chain before anything counts as paid.
 */
export const USDC_DECIMALS = 6;
export const usdcBaseUnits = (cents: number) => BigInt(cents) * 10_000n;
export const splitSchema = z
  .object({ totalCents: z.number().int().min(100).max(1_000_000) })
  .strict();
export const paidSchema = z.object({ txHash }).strict();
export function computeShares(input: {
  totalCents: number;
  members: { id: string; plusOnes: number }[];
  hostId: string;
}) {
  const people = input.members.reduce((total, member) => total + 1 + member.plusOnes, 0);
  const others = input.members.filter((member) => member.id !== input.hostId);
  let unit = Math.ceil(input.totalCents / Math.max(1, people));
  if (input.totalCents - unit * others.length < 0) unit = Math.floor(input.totalCents / people);
  const shares = new Map(others.map((member) => [member.id, unit]));
  return { unitCents: unit, hostCents: input.totalCents - unit * others.length, shares };
}
async function gatheringDetailLazy() {
  return (await import("./gatherings")).gatheringDetail;
}
export async function startSplit(
  host: s.UserRow,
  gatheringId: string,
  body: z.infer<typeof splitSchema>,
) {
  await requireMember(host.id);
  const db = await getDb();
  const [gathering] = await db.select().from(s.gatherings).where(eq(s.gatherings.id, gatheringId));
  invariant(gathering, "NOT_FOUND", "Table not found.", 404);
  invariant(
    gathering.hostUserId === host.id,
    "FORBIDDEN",
    "Only the host can split the bill.",
    403,
  );
  invariant(gathering.status !== "cancelled", "TABLE_CLOSED", "This table was cancelled.", 409);
  invariant(
    gathering.splitStatus === "none",
    "SPLIT_EXISTS",
    "The bill is already being split.",
    409,
  );
  const [hostTrip] = await db.select().from(s.trips).where(eq(s.trips.id, gathering.tripId));
  const payAddress = await chain().readAddr(hostTrip.ensName, ETH_COIN_TYPE);
  invariant(payAddress, "SPLIT_NO_ADDRESS", "Your trip name does not resolve to an address.", 409);
  await applyWrite(host.id, "split.start", gatheringId, async (tx) => {
    const attendees = await tx
      .select()
      .from(s.gatheringAttendees)
      .where(
        and(
          eq(s.gatheringAttendees.gatheringId, gatheringId),
          eq(s.gatheringAttendees.status, "approved"),
        ),
      );
    invariant(
      attendees.some((row) => row.role === "member"),
      "SPLIT_ALONE",
      "Nobody else is at this table.",
      409,
    );
    const shares = computeShares({
      totalCents: body.totalCents,
      members: attendees.map((row) => ({ id: row.userId, plusOnes: row.plusOnes })),
      hostId: host.id,
    });
    for (const row of attendees)
      await tx
        .update(s.gatheringAttendees)
        .set({
          shareCents: row.role === "host" ? shares.hostCents : (shares.shares.get(row.userId) ?? 0),
          payAddress: row.role === "host" ? null : payAddress,
          updatedAt: new Date(),
        })
        .where(eq(s.gatheringAttendees.id, row.id));
    await tx
      .update(s.gatherings)
      .set({
        splitStatus: "pending",
        splitTotalCents: body.totalCents,
        splitCurrency: "USD",
        updatedAt: new Date(),
      })
      .where(eq(s.gatherings.id, gatheringId));
  });
  return (await gatheringDetailLazy())(host, gatheringId);
}
async function ownShare(user: s.UserRow, gatheringId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ attendee: s.gatheringAttendees, gathering: s.gatherings })
    .from(s.gatheringAttendees)
    .innerJoin(s.gatherings, eq(s.gatheringAttendees.gatheringId, s.gatherings.id))
    .where(
      and(
        eq(s.gatheringAttendees.gatheringId, gatheringId),
        eq(s.gatheringAttendees.userId, user.id),
      ),
    );
  invariant(
    row && row.attendee.role === "member" && row.attendee.status === "approved",
    "NOT_FOUND",
    "You have no share at this table.",
    404,
  );
  invariant(
    row.gathering.splitStatus === "pending" &&
      row.attendee.shareCents != null &&
      row.attendee.payAddress,
    "SPLIT_NOT_STARTED",
    "The host has not split the bill yet.",
    409,
  );
  return row;
}
/** A browser-reported hash. Stored, queued for verification, never trusted on its own. */
export async function reportPayment(
  user: s.UserRow,
  gatheringId: string,
  body: z.infer<typeof paidSchema>,
) {
  const { attendee } = await ownShare(user, gatheringId);
  if (attendee.paidTx !== body.txHash) {
    invariant(!attendee.paidVerifiedAt, "ALREADY_PAID", "This share is already settled.", 409);
    await applyWrite(user.id, "split.paid_hint", attendee.id, async (tx) => {
      await tx
        .update(s.gatheringAttendees)
        .set({ paidTx: body.txHash, paidVerifiedAt: null, updatedAt: new Date() })
        .where(eq(s.gatheringAttendees.id, attendee.id));
      await enqueueEnsJob(tx, { kind: "split.verify", signer: "none", entityId: attendee.id });
    });
  }
  await tickEnsWorld();
  return (await gatheringDetailLazy())(user, gatheringId);
}
/** Demo only: move simulated USDC from the member's wallet to the host and report it. */
export async function simulatePayment(user: s.UserRow, gatheringId: string) {
  invariant(isDemo(), "NOT_FOUND", "Not found.", 404);
  const { attendee } = await ownShare(user, gatheringId);
  const db = await getDb();
  const [wallet] = await db
    .select()
    .from(s.walletLinks)
    .where(eq(s.walletLinks.userId, user.id))
    .orderBy(asc(s.walletLinks.verifiedAt))
    .limit(1);
  invariant(wallet, "WALLET_UNVERIFIED", "Link a wallet first.", 403);
  const submission = await chain().simulateTransfer!({
    from: wallet.address,
    to: attendee.payAddress!,
    amount: usdcBaseUnits(attendee.shareCents!),
  });
  return reportPayment(user, gatheringId, { txHash: submission.hash });
}
registerEnsJobHandler("split.verify", async (job) => {
  const db = await getDb();
  const [attendee] = await db
    .select()
    .from(s.gatheringAttendees)
    .where(eq(s.gatheringAttendees.id, job.entityId));
  invariant(
    attendee && attendee.paidTx && attendee.payAddress && attendee.shareCents != null,
    "NOT_FOUND",
    "Share not found.",
    404,
  );
  if (attendee.paidVerifiedAt) return { txHash: attendee.paidTx };
  const transfer = await chain().erc20Transfer(attendee.paidTx);
  if (!transfer) throw new AppError("PENDING", "Transfer not seen yet.", 409, true);
  invariant(
    transfer.to === attendee.payAddress.toLowerCase(),
    "WRONG_RECIPIENT",
    "Paid to the wrong address.",
    409,
  );
  const wallets = await db
    .select()
    .from(s.walletLinks)
    .where(eq(s.walletLinks.userId, attendee.userId));
  invariant(
    wallets.some((wallet) => wallet.address === transfer.from),
    "WRONG_PAYER",
    "Paid from a wallet that is not linked to this member.",
    409,
  );
  invariant(
    transfer.amount >= usdcBaseUnits(attendee.shareCents),
    "UNDERPAID",
    "The transfer is short.",
    409,
  );
  invariant(transfer.success, "TX_FAILED", "The transfer reverted.", 409);
  if (!transfer.finalized) throw new AppError("PENDING", "Waiting for finality.", 409, true);
  await applyWrite(null, "split.verified", attendee.id, async (tx) => {
    await tx
      .update(s.gatheringAttendees)
      .set({ paidVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(s.gatheringAttendees.id, attendee.id));
    const open = await tx
      .select()
      .from(s.gatheringAttendees)
      .where(
        and(
          eq(s.gatheringAttendees.gatheringId, attendee.gatheringId),
          eq(s.gatheringAttendees.status, "approved"),
          eq(s.gatheringAttendees.role, "member"),
        ),
      );
    if (open.every((row) => row.id === attendee.id || row.paidVerifiedAt))
      await tx
        .update(s.gatherings)
        .set({ splitStatus: "settled", updatedAt: new Date() })
        .where(eq(s.gatherings.id, attendee.gatheringId));
  });
  return { txHash: attendee.paidTx };
});
