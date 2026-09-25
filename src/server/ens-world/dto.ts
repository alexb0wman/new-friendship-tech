import type * as s from "@/server/db/schema";
import { explorerName, explorerTx } from "@/server/ens-v2/addresses";
import type { NowRecord, TripDTO } from "@/lib/types";

/** The public shape of a Right now invitation as it appears on chain and in DTOs. */
export function nowRecord(
  post: typeof s.nowPosts.$inferSelect | null | undefined,
): NowRecord | null {
  if (!post || !post.active || post.expiresAt <= new Date()) return null;
  return { kind: post.kind, area: post.neighborhood, until: post.expiresAt.toISOString() };
}
export function tripDTO(
  row: s.TripRow,
  user: { verifiedHumanAt: Date | null },
  now: NowRecord | null = null,
): TripDTO {
  return {
    id: row.id,
    city: row.city,
    label: row.label,
    name: row.ensName,
    status: row.status,
    arrivesAt: row.arrivesAt.toISOString(),
    departsAt: row.departsAt.toISOString(),
    chainTx: row.chainTx,
    recordsTx: row.recordsTx,
    chainVerifiedAt: row.chainVerifiedAt?.toISOString() ?? null,
    verifiedHuman: !!user.verifiedHumanAt,
    now,
    payAddress: row.payAddress,
    explorer: { name: explorerName(row.ensName), tx: explorerTx(row.chainTx) },
  };
}
