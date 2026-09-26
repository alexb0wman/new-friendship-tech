import { and, asc, eq, isNull } from "drizzle-orm";
import { isAddress, zeroAddress, type Hex } from "viem";
import { z } from "zod";
import { getDb } from "@/server/db";
import * as s from "@/server/db/schema";
import { applyWrite } from "@/server/db/write";
import { AppError, invariant } from "@/server/errors";
import { isDemo, txHash, walletAddress } from "@/server/config";
import { requireTripAccess } from "@/server/membership";
import { chain } from "@/server/ens-v2/chain";
import { ETH_COIN_TYPE } from "@/server/ens-v2/addresses";
import { enqueueEnsJob, registerEnsJobHandler } from "@/server/ens-v2/jobs";
import { tickEnsWorld } from "./trips";
import {
  splitCalldata,
  splitMinimumBlock,
  splitNetwork,
  verifySplitTransfer,
  type SplitObligation,
} from "@/server/splits/settlement";

/**
 * Splitting the bill: equal shares across the people at the table, plus-ones included in the
 * head count but paid by the host (a plus-one has no name to resolve). Members pay the host's
 * address, resolved fresh from the host's trip name when the split starts. Settlement is
 * native USDC on the independently configured mainnet (local simulation in demo mode).
 * Chain, token, recipient, and shares are frozen. A reported hash is a hint; the worker
 * reads the transfer from the chain before anything counts as paid.
 */
export const USDC_DECIMALS = 6;
export const usdcBaseUnits = (cents: number) => BigInt(cents) * 10_000n;
export const splitSchema = z
  .object({ totalCents: z.number().int().min(100).max(1_000_000) })
  .strict();
export const paidSchema = z.object({ txHash }).strict();
export const preparePaymentSchema = z.object({ payer: walletAddress }).strict();
const REPLACEABLE_HINT_CODES = new Set([
  "TX_FAILED",
  "WRONG_TOKEN",
  "WRONG_AMOUNT",
  "WRONG_TRANSFER",
  "WRONG_TRANSACTION",
  "WRONG_PAYER",
  "WRONG_RECIPIENT",
  "OLD_TRANSACTION",
  "SPLIT_REPLAY",
]);
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
  await requireTripAccess(host.id);
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
  invariant(hostTrip, "NOT_FOUND", "Host trip not found.", 404);
  const payAddress = await chain().readAddr(hostTrip.ensName, ETH_COIN_TYPE);
  invariant(
    payAddress && isAddress(payAddress) && payAddress.toLowerCase() !== zeroAddress,
    "SPLIT_NO_ADDRESS",
    "Your trip name does not resolve to a valid payment address.",
    409,
  );
  const hostWallets = await db
    .select()
    .from(s.walletLinks)
    .where(eq(s.walletLinks.userId, host.id));
  invariant(
    hostWallets.some((wallet) => wallet.address.toLowerCase() === payAddress.toLowerCase()),
    "SPLIT_UNVERIFIED_RECIPIENT",
    "The host's ENS address must be a linked wallet.",
    409,
  );
  const network = splitNetwork();
  await splitMinimumBlock(network.chainId); // Validate the independent settlement RPC before creating obligations.
  await applyWrite(host.id, "split.start", gatheringId, async (tx) => {
    const [locked] = await tx
      .select()
      .from(s.gatherings)
      .where(eq(s.gatherings.id, gatheringId))
      .for("update");
    invariant(
      locked?.splitStatus === "none",
      "SPLIT_EXISTS",
      "The bill is already being split.",
      409,
    );
    invariant(locked.status !== "cancelled", "TABLE_CLOSED", "This table was cancelled.", 409);
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
          payAddress: row.role === "host" ? null : payAddress.toLowerCase(),
          updatedAt: new Date(),
        })
        .where(eq(s.gatheringAttendees.id, row.id));
    await tx
      .update(s.gatherings)
      .set({
        splitStatus: "pending",
        splitTotalCents: body.totalCents,
        splitCurrency: "USD",
        splitChainId: network.chainId,
        splitToken: network.token,
        splitStartedAt: new Date(),
        status: "closed",
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
    row.gathering.splitStatus !== "none" &&
      row.attendee.shareCents != null &&
      row.attendee.payAddress,
    "SPLIT_NOT_STARTED",
    "The host has not split the bill yet.",
    409,
  );
  return row;
}
/** Bind the verified payer once, before asking their wallet to sign anything. */
export async function preparePayment(
  user: s.UserRow,
  gatheringId: string,
  body: z.infer<typeof preparePaymentSchema>,
) {
  const { attendee, gathering } = await ownShare(user, gatheringId);
  invariant(!attendee.paidVerifiedAt, "ALREADY_PAID", "This share is already settled.", 409);
  invariant(
    gathering.splitChainId != null && gathering.splitToken,
    "SPLIT_LEGACY_REVIEW",
    "This older split requires review before payment.",
    409,
  );
  const db = await getDb();
  const [wallet] = await db
    .select()
    .from(s.walletLinks)
    .where(and(eq(s.walletLinks.userId, user.id), eq(s.walletLinks.address, body.payer)));
  invariant(wallet, "WALLET_UNVERIFIED", "Select a wallet linked to your account.", 403);
  const minimum = attendee.splitMinBlock ?? (await splitMinimumBlock(gathering.splitChainId));
  const payer = await applyWrite(user.id, "split.prepare", attendee.id, async (tx) => {
    const [locked] = await tx
      .select()
      .from(s.gatheringAttendees)
      .where(eq(s.gatheringAttendees.id, attendee.id))
      .for("update");
    invariant(!locked.paidVerifiedAt, "ALREADY_PAID", "This share is already settled.", 409);
    invariant(
      !locked.splitPayer || locked.splitPayer === body.payer,
      "PAYER_FROZEN",
      "Use the wallet already selected for this payment.",
      409,
    );
    if (!locked.splitPayer)
      await tx
        .update(s.gatheringAttendees)
        .set({ splitPayer: body.payer, splitMinBlock: minimum, updatedAt: new Date() })
        .where(eq(s.gatheringAttendees.id, attendee.id));
    return locked.splitPayer ?? body.payer;
  });
  return {
    chainId: gathering.splitChainId,
    from: payer,
    to: gathering.splitToken,
    data: splitCalldata({
      recipient: attendee.payAddress!,
      amount: usdcBaseUnits(attendee.shareCents!),
    }),
    value: "0x0",
  };
}
/** A browser-reported hash. Stored, queued for verification, never trusted on its own. */
export async function reportPayment(
  user: s.UserRow,
  gatheringId: string,
  body: z.infer<typeof paidSchema>,
) {
  const { attendee } = await ownShare(user, gatheringId);
  // Legacy demo callers can report a simulated hint without an explicit wallet preparation.
  if (!attendee.splitPayer && isDemo()) {
    const db = await getDb();
    const [wallet] = await db
      .select()
      .from(s.walletLinks)
      .where(eq(s.walletLinks.userId, user.id))
      .orderBy(asc(s.walletLinks.verifiedAt))
      .limit(1);
    invariant(wallet, "WALLET_UNVERIFIED", "Link a wallet first.", 403);
    await preparePayment(user, gatheringId, { payer: wallet.address });
  }
  if (attendee.paidVerifiedAt) {
    invariant(
      attendee.paidTx === body.txHash,
      "ALREADY_PAID",
      "This share is already settled.",
      409,
    );
    return (await gatheringDetailLazy())(user, gatheringId);
  }
  await applyWrite(user.id, "split.paid_hint", attendee.id, async (tx) => {
    const [locked] = await tx
      .select()
      .from(s.gatheringAttendees)
      .where(eq(s.gatheringAttendees.id, attendee.id))
      .for("update");
    invariant(
      locked.splitPayer && locked.splitMinBlock != null,
      "PAYMENT_NOT_PREPARED",
      "Prepare this payment with your linked wallet first.",
      409,
    );
    invariant(
      !locked.paidVerifiedAt || locked.paidTx === body.txHash,
      "ALREADY_PAID",
      "This share is already settled.",
      409,
    );
    if (locked.paidVerifiedAt) return;
    invariant(
      isDemo() ||
        !locked.paidTx ||
        locked.paidTx === body.txHash ||
        (locked.splitErrorCode && REPLACEABLE_HINT_CODES.has(locked.splitErrorCode)),
      "PAYMENT_PENDING",
      "The reported payment is still being checked. Do not pay again.",
      409,
    );
    await tx
      .update(s.gatheringAttendees)
      .set({ paidTx: body.txHash, splitErrorCode: null, updatedAt: new Date() })
      .where(eq(s.gatheringAttendees.id, attendee.id));
    await enqueueEnsJob(tx, {
      kind: "split.verify",
      signer: "none",
      entityId: attendee.id,
      payload: { txHash: body.txHash },
    });
  });
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
  await preparePayment(user, gatheringId, { payer: wallet.address });
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
  if (job.payload.txHash && job.payload.txHash !== attendee.paidTx) return {};
  const [gathering] = await db
    .select()
    .from(s.gatherings)
    .where(eq(s.gatherings.id, attendee.gatheringId));
  invariant(
    gathering.splitChainId != null &&
      gathering.splitToken &&
      attendee.splitPayer &&
      attendee.splitMinBlock != null,
    "SPLIT_LEGACY_REVIEW",
    "The payment obligation is incomplete.",
    409,
  );
  const obligation: SplitObligation = {
    chainId: gathering.splitChainId,
    token: gathering.splitToken,
    payer: attendee.splitPayer,
    recipient: attendee.payAddress,
    amount: usdcBaseUnits(attendee.shareCents),
    minBlock: BigInt(attendee.splitMinBlock),
  };
  try {
    const evidence = await verifySplitTransfer(obligation, attendee.paidTx as Hex);
    await applyWrite(null, "split.verified", attendee.id, async (tx) => {
      await tx
        .select()
        .from(s.gatherings)
        .where(eq(s.gatherings.id, attendee.gatheringId))
        .for("update");
      const [locked] = await tx
        .select()
        .from(s.gatheringAttendees)
        .where(eq(s.gatheringAttendees.id, attendee.id))
        .for("update");
      if (locked.paidVerifiedAt || locked.paidTx !== attendee.paidTx) return;
      const [replay] = await tx
        .select()
        .from(s.gatheringAttendees)
        .where(eq(s.gatheringAttendees.splitSettlementKey, evidence.settlementKey));
      invariant(!replay, "SPLIT_REPLAY", "This transaction already settled another share.", 409);
      await tx
        .update(s.gatheringAttendees)
        .set({
          paidVerifiedAt: new Date(),
          splitSettlementKey: evidence.settlementKey,
          splitErrorCode: null,
          updatedAt: new Date(),
        })
        .where(eq(s.gatheringAttendees.id, attendee.id));
      const open = await tx
        .select()
        .from(s.gatheringAttendees)
        .where(
          and(
            eq(s.gatheringAttendees.gatheringId, attendee.gatheringId),
            eq(s.gatheringAttendees.role, "member"),
          ),
        );
      if (
        open
          .filter((row) => row.shareCents != null)
          .every((row) => row.id === attendee.id || row.paidVerifiedAt)
      )
        await tx
          .update(s.gatherings)
          .set({ splitStatus: "settled", updatedAt: new Date() })
          .where(eq(s.gatherings.id, attendee.gatheringId));
    });
  } catch (error) {
    const code = error instanceof AppError ? error.code : "PENDING";
    await db
      .update(s.gatheringAttendees)
      .set({ splitErrorCode: code })
      .where(
        and(
          eq(s.gatheringAttendees.id, attendee.id),
          eq(s.gatheringAttendees.paidTx, attendee.paidTx),
          isNull(s.gatheringAttendees.paidVerifiedAt),
        ),
      );
    throw error;
  }
  return { txHash: attendee.paidTx };
});
