import { invariant } from "./errors";
export interface PreparedENSWrite {
  wallet: string;
  resolver: string;
  calldata: string;
  chainId: number;
  description: string;
}
export function assertENSWriteProof(
  intent: PreparedENSWrite,
  tx: { from: string; to: string | null; input: string; value: bigint; chainId?: number },
  receipt: { status: string },
  currentDescription: string | null,
  chainId: number,
) {
  invariant(chainId === intent.chainId, "ENS_CHAIN", "ENS RPC is on the wrong network.", 503);
  invariant(
    receipt.status === "success",
    "ENS_TX_FAILED",
    "The record update has not succeeded.",
    409,
  );
  invariant(
    tx.from.toLowerCase() === intent.wallet.toLowerCase(),
    "ENS_TX_OWNER",
    "The transaction came from a different wallet.",
    403,
  );
  invariant(
    tx.to?.toLowerCase() === intent.resolver.toLowerCase() &&
      tx.input.toLowerCase() === intent.calldata.toLowerCase() &&
      tx.value === 0n,
    "ENS_TX_MISMATCH",
    "The transaction does not match this prepared record update.",
    409,
  );
  invariant(
    currentDescription === intent.description,
    "ENS_RECORD_MISMATCH",
    "The current record does not match the requested update. Refresh before continuing.",
    409,
  );
}
