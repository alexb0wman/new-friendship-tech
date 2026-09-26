import { z } from "zod";
import { AppError, invariant } from "@/server/errors";
import type { MerchantPayment } from "@/lib/payment-types";
import { BASE_USDC, SOURCE_CHAIN, DESTINATION_CHAIN, merchantConfiguration } from "./merchant";

const hash = z
  .string()
  .regex(/^0x[\da-fA-F]{64}$/)
  .transform((v) => v.toLowerCase());
const address = z
  .string()
  .regex(/^0x[\da-fA-F]{40}$/)
  .transform((v) => v.toLowerCase());
const quantity = z.string().regex(/^0x[\da-fA-F]+$/);
const txSchema = z.object({
  hash,
  from: address,
  to: address.nullable(),
  input: z.string(),
  value: quantity,
  blockHash: hash,
  blockNumber: quantity,
});
const receiptSchema = z.object({
  transactionHash: hash,
  status: quantity,
  blockHash: hash,
  blockNumber: quantity,
  logs: z.array(
    z.object({
      address,
      topics: z.array(hash),
      data: z.string().regex(/^0x(?:[\da-fA-F]{2})*$/),
      removed: z.boolean().optional(),
    }),
  ),
});
const blockSchema = z.object({ hash, number: quantity, timestamp: quantity });
export type ProvenTransaction = {
  tx: z.infer<typeof txSchema>;
  receipt: z.infer<typeof receiptSchema>;
  timestamp: number;
  finalized: boolean;
  blockTag: string;
};
export async function paymentRpc(url: string, method: string, params: unknown[]) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    invariant(response.ok, "RPC_UNAVAILABLE", "Payment verification RPC is unavailable.", 503);
    const payload = (await response.json()) as { error?: unknown; result?: unknown };
    invariant(
      !payload.error && "result" in payload,
      method === "debug_traceTransaction" ? "PAYMENT_TRACE_UNAVAILABLE" : "RPC_UNAVAILABLE",
      "The RPC could not independently verify this payment. Your invoice is retained.",
      503,
    );
    return payload.result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "RPC_UNAVAILABLE",
      "Payment verification RPC is unavailable. Your invoice is retained.",
      503,
      true,
    );
  }
}
export async function readProvenTransaction(
  url: string,
  chainId: number,
  txHash: string,
  confirmations: number,
): Promise<ProvenTransaction | null> {
  hash.parse(txHash);
  invariant(
    Number(await paymentRpc(url, "eth_chainId", [])) === chainId,
    "WRONG_CHAIN",
    "Payment RPC is on another network.",
    503,
  );
  const [transaction, receiptBody, head] = await Promise.all([
    paymentRpc(url, "eth_getTransactionByHash", [txHash]),
    paymentRpc(url, "eth_getTransactionReceipt", [txHash]),
    paymentRpc(url, "eth_blockNumber", []),
  ]);
  if (!transaction || !receiptBody) return null;
  // A pending transaction has no block hash; retain it for the next worker pass.
  if (!(transaction as Record<string, unknown>).blockHash) return null;
  const tx = txSchema.parse(transaction),
    receipt = receiptSchema.parse(receiptBody);
  invariant(
    tx.hash === txHash.toLowerCase() &&
      receipt.transactionHash === tx.hash &&
      receipt.blockHash === tx.blockHash &&
      receipt.blockNumber === tx.blockNumber,
    "WRONG_SOURCE_TX",
    "Transaction and receipt disagree.",
    409,
  );
  const block = blockSchema.parse(
    await paymentRpc(url, "eth_getBlockByNumber", [receipt.blockNumber, false]),
  );
  invariant(
    block.hash === receipt.blockHash && block.number === receipt.blockNumber,
    "PAYMENT_REORG",
    "The payment block is no longer canonical. Verification will retry.",
    409,
  );
  invariant(BigInt(receipt.status) === 1n, "TX_FAILED", "The payment transaction reverted.", 409);
  const finalized =
    BigInt(quantity.parse(head)) - BigInt(block.number) + 1n >= BigInt(confirmations);
  return {
    tx,
    receipt,
    timestamp: Number(BigInt(block.timestamp)) * 1000,
    finalized,
    blockTag: receipt.blockNumber,
  };
}
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export function validateSourceProof(payment: MerchantPayment, proof: ProvenTransaction) {
  const expected = payment.transactions.find((tx) => tx.deposit)!;
  invariant(
    proof.tx.from === payment.sourceWallet,
    "WRONG_PAYER",
    "Source transaction was signed by another wallet.",
    409,
  );
  invariant(
    proof.tx.to === expected.to &&
      proof.tx.input.toLowerCase() === expected.data &&
      BigInt(proof.tx.value) === BigInt(expected.value),
    "WRONG_SOURCE_TX",
    "Source transaction does not match the server quote.",
    409,
  );
  invariant(
    proof.timestamp >= Date.parse(payment.quotedAt) - 30000 &&
      proof.timestamp <= Date.parse(payment.expiresAt),
    "PAYMENT_OUTSIDE_QUOTE",
    "The payment was mined outside its quote. Support must review it.",
    409,
  );
  let sent = 0n;
  for (const log of proof.receipt.logs) {
    if (
      log.address !== BASE_USDC ||
      log.topics[0] !== TRANSFER ||
      log.topics.length !== 3 ||
      log.removed
    )
      continue;
    invariant(
      /^0x[\da-fA-F]{64}$/.test(log.data),
      "INVALID_AMOUNT",
      "Malformed USDC transfer log.",
      409,
    );
    const from = "0x" + log.topics[1].slice(-40),
      to = "0x" + log.topics[2].slice(-40);
    if (from === payment.sourceWallet) sent += BigInt(log.data);
    if (to === payment.sourceWallet) sent -= BigInt(log.data);
  }
  invariant(
    sent === BigInt(payment.sourceAmount),
    "UNDERPAID",
    "Source USDC movement does not match the quoted price.",
    409,
  );
}
export async function proveSource(payment: MerchantPayment, sourceTx: string) {
  const cfg = merchantConfiguration();
  const proof = await readProvenTransaction(
    cfg.sourceRpc,
    SOURCE_CHAIN,
    sourceTx,
    cfg.sourceConfirmations,
  );
  if (!proof) return null;
  validateSourceProof(payment, proof);
  return proof;
}
export interface CallFrame {
  type: string;
  from?: string;
  to?: string;
  value?: string;
  error?: string;
  calls?: CallFrame[];
}
/** Successful native CALL transfers only; a reverted ancestor reverses every descendant. */
export function nativeReceived(frame: CallFrame, recipient: string, depth = 0): bigint {
  invariant(depth < 128, "PAYMENT_TRACE_INVALID", "Payment trace is too deep.", 503);
  if (frame.error) return 0n;
  let amount = 0n;
  if (["CALL", "CREATE", "CREATE2", "SELFDESTRUCT"].includes(frame.type.toUpperCase())) {
    const value = BigInt(quantity.parse(frame.value ?? "0x0"));
    if (frame.to?.toLowerCase() === recipient) amount += value;
    if (frame.from?.toLowerCase() === recipient) amount -= value;
  }
  for (const call of frame.calls ?? []) amount += nativeReceived(call, recipient, depth + 1);
  return amount;
}
export async function proveNativeDestination(payment: MerchantPayment, txHash: string) {
  const cfg = merchantConfiguration();
  const proof = await readProvenTransaction(
    cfg.destinationRpc,
    DESTINATION_CHAIN,
    txHash,
    cfg.confirmations,
  );
  if (!proof) return null;
  // Restrict treasury to a normal EOA; contract recipients need an application-specific accounting proof.
  const code = await paymentRpc(cfg.destinationRpc, "eth_getCode", [
    payment.recipient,
    proof.blockTag,
  ]);
  invariant(
    code === "0x" || code === "0x0",
    "UNSUPPORTED_TREASURY",
    "Contract treasury settlement needs a dedicated verifier.",
    409,
  );
  let amount: bigint;
  if (proof.tx.to === payment.recipient)
    amount = proof.tx.from === payment.recipient ? 0n : BigInt(proof.tx.value);
  else {
    const trace = (await paymentRpc(cfg.destinationRpc, "debug_traceTransaction", [
      txHash,
      { tracer: "callTracer", timeout: "10s" },
    ])) as CallFrame;
    invariant(
      trace &&
        trace.type?.toUpperCase() === "CALL" &&
        trace.from?.toLowerCase() === proof.tx.from &&
        trace.to?.toLowerCase() === proof.tx.to &&
        BigInt(quantity.parse(trace.value ?? "0x0")) === BigInt(proof.tx.value) &&
        !trace.error,
      "PAYMENT_TRACE_INVALID",
      "Destination trace does not match its successful transaction.",
      503,
    );
    amount = nativeReceived(trace, payment.recipient);
  }
  // Recheck canonicality after trace retrieval, which may be slower than ordinary reads.
  const block = blockSchema.parse(
    await paymentRpc(cfg.destinationRpc, "eth_getBlockByNumber", [proof.blockTag, false]),
  );
  invariant(
    block.hash === proof.receipt.blockHash,
    "PAYMENT_REORG",
    "Settlement changed during verification.",
    409,
  );
  invariant(
    amount >= BigInt(payment.minimumOutput),
    "UNDERPAID",
    "The treasury received less than the quoted minimum.",
    409,
  );
  return { amount: amount.toString(), finalized: proof.finalized };
}
