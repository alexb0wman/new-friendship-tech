import { invariant } from "@/server/errors";
import type { Receipt, RecordWrite, TxSubmission } from "./types";

/** Key used in the observed map for a record: `text:<key>` or `addr:<coinType>`. */
export const observedKey = (record: RecordWrite) =>
  record.type === "text" ? "text:" + record.key : "addr:" + record.coinType;

/**
 * A chain write counts only when the mined transaction is exactly the one we prepared and a fresh
 * read of every record we wrote returns the value we wrote. Generalises `ens-proof.ts` from one
 * description record to any record set and any signer.
 */
export function assertChainWriteProof(input: {
  submission: TxSubmission;
  receipt: Receipt;
  expected: { records: RecordWrite[] };
  observed: Record<string, string | null>;
}) {
  const { submission, receipt } = input;
  invariant(
    receipt.status !== "pending",
    "PENDING",
    "The transaction has not been mined yet.",
    409,
  );
  invariant(receipt.status === "success", "ENS_TX_FAILED", "The record update reverted.", 409);
  invariant(
    receipt.to?.toLowerCase() === submission.to.toLowerCase() &&
      receipt.from?.toLowerCase() === submission.from.toLowerCase() &&
      receipt.input?.toLowerCase() === submission.calldata.toLowerCase(),
    "ENS_TX_MISMATCH",
    "The mined transaction does not match the prepared write.",
    409,
  );
  for (const record of input.expected.records) {
    const seen = input.observed[observedKey(record)] ?? null;
    const wanted = record.type === "text" ? record.value : record.address.toLowerCase();
    const matches =
      wanted === ""
        ? seen === null || seen === ""
        : (seen ?? "").toLowerCase() === wanted.toLowerCase();
    invariant(
      matches,
      "ENS_RECORD_MISMATCH",
      "A fresh read of " + observedKey(record) + " does not return the value that was written.",
      409,
    );
  }
}
