import { createHash } from "node:crypto";
import { invariant } from "@/server/errors";
export interface Obligation {
  chainId: number;
  recipient: string;
  asset: string;
  amount: string;
  sourceWallet: string;
  providerQuoteId: string;
}
export interface SettlementEvidence {
  chainId: number;
  recipient: string;
  asset: string;
  amount: string;
  sourceWallet: string;
  providerQuoteId: string;
  txHash: string;
  settlementIndex: string;
  success: boolean;
  finalized: boolean;
}
/** Internal adapter boundary only. There is deliberately no HTTP endpoint accepting this evidence. */
export function verifyEvidence(expected: Obligation, evidence: SettlementEvidence) {
  invariant(evidence.success, "TX_FAILED", "The payment transaction failed.", 409);
  invariant(evidence.finalized, "NOT_FINAL", "Payment is still confirming.", 409);
  invariant(
    evidence.chainId === expected.chainId,
    "WRONG_CHAIN",
    "Unexpected settlement network.",
    409,
  );
  invariant(
    evidence.recipient.toLowerCase() === expected.recipient.toLowerCase(),
    "WRONG_RECIPIENT",
    "Unexpected payment recipient.",
    409,
  );
  invariant(
    evidence.asset.toLowerCase() === expected.asset.toLowerCase(),
    "WRONG_ASSET",
    "Unexpected settlement asset.",
    409,
  );
  invariant(
    evidence.sourceWallet.toLowerCase() === expected.sourceWallet.toLowerCase(),
    "WRONG_PAYER",
    "Payment does not match the verified source wallet.",
    409,
  );
  invariant(
    evidence.providerQuoteId === expected.providerQuoteId,
    "WRONG_QUOTE",
    "Payment does not match this invoice.",
    409,
  );
  invariant(
    /^[0-9]+$/.test(evidence.amount) && /^[0-9]+$/.test(expected.amount),
    "INVALID_AMOUNT",
    "Invalid base-unit amount.",
    409,
  );
  invariant(
    BigInt(expected.amount) > 0n && BigInt(evidence.amount) >= BigInt(expected.amount),
    "UNDERPAID",
    "Payment is below the quoted amount.",
    409,
  );
  invariant(
    /^0x[0-9a-fA-F]{64}$/.test(evidence.txHash),
    "INVALID_TX",
    "Invalid settlement transaction.",
    409,
  );
  invariant(
    /^[a-zA-Z0-9:_-]{1,80}$/.test(evidence.settlementIndex),
    "INVALID_EVENT",
    "Invalid settlement identifier.",
    409,
  );
  const key =
    evidence.chainId + ":" + evidence.txHash.toLowerCase() + ":" + evidence.settlementIndex;
  return { key, hash: createHash("sha256").update(JSON.stringify(evidence)).digest("hex") };
}
