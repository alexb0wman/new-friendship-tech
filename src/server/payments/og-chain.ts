import { OG_MAINNET_CHAIN_ID } from "@/lib/constants";
import { AppError } from "@/server/errors";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

type Rpc = { result?: unknown; error?: { message?: string } };

async function rpc(method: string, params: unknown[]) {
  const url = process.env.PAYMENT_RPC_URL || "https://evmrpc.0g.ai";
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new AppError("RPC_UNAVAILABLE", "0G RPC did not respond.", 503, true);
  const body = (await response.json()) as Rpc;
  if (body.error) throw new AppError("RPC_UNAVAILABLE", "0G RPC rejected the read.", 503, true);
  return body.result ?? null;
}

function addressFromTopic(topic: string) {
  return ("0x" + topic.slice(-40)).toLowerCase();
}

/** Reads a 0G mainnet transaction. A browser callback is not accepted as proof. */
export async function readOgTransfer(txHash: string) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new AppError("INVALID_TX", "Invalid settlement transaction.", 422);
  }
  const chain = await rpc("eth_chainId", []);
  if (Number(chain) !== OG_MAINNET_CHAIN_ID) {
    throw new AppError("WRONG_CHAIN", "Payment RPC is not 0G mainnet.", 503);
  }
  const [tx, receipt, blockHex] = await Promise.all([
    rpc("eth_getTransactionByHash", [txHash]) as Promise<{
      from?: string;
      to?: string;
      value?: string;
      blockNumber?: string;
    } | null>,
    rpc("eth_getTransactionReceipt", [txHash]) as Promise<{
      status?: string;
      blockNumber?: string;
      logs?: { address: string; topics: string[]; data: string }[];
    } | null>,
    rpc("eth_blockNumber", []) as Promise<string | null>,
  ]);
  if (!tx || !receipt || !blockHex) return null;
  const confirmations = Number(process.env.PAYMENT_CONFIRMATIONS || 12);
  const head = Number(blockHex);
  const block = Number(receipt.blockNumber || tx.blockNumber || 0);
  const finalized = block > 0 && head - block + 1 >= confirmations;
  const nativeTo = (tx.to || "").toLowerCase();
  const nativeAmount = BigInt(tx.value || "0x0").toString();
  const token = receipt.logs?.find(
    (log) => log.topics[0] === TRANSFER_TOPIC && log.topics.length >= 3,
  );
  return {
    chainId: OG_MAINNET_CHAIN_ID,
    success: receipt.status === "0x1",
    finalized,
    from: (tx.from || "").toLowerCase(),
    nativeTo,
    nativeAmount,
    token: token
      ? {
          asset: token.address.toLowerCase(),
          from: addressFromTopic(token.topics[1]),
          to: addressFromTopic(token.topics[2]),
          amount: BigInt(token.data).toString(),
        }
      : null,
    txHash,
  };
}
