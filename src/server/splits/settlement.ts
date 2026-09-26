import {
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  erc20Abi,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { base, mainnet } from "viem/chains";
import { isDemo } from "@/server/config";
import { chain } from "@/server/ens-v2/chain";
import { AppError, invariant } from "@/server/errors";

// Circle's native USDC deployments, verified against:
// https://developers.circle.com/stablecoins/usdc-contract-addresses
export const SPLIT_NETWORKS = {
  base: {
    chainId: 8453,
    name: "Base",
    token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    explorer: "https://basescan.org",
    chain: base,
  },
  ethereum: {
    chainId: 1,
    name: "Ethereum",
    token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    explorer: "https://etherscan.io",
    chain: mainnet,
  },
} as const;
export function splitNetwork(chainId?: number | null) {
  if (chainId === 0 || (chainId == null && isDemo())) {
    invariant(isDemo(), "SPLIT_SIMULATION_FORBIDDEN", "Simulated payments are local only.", 503);
    return {
      chainId: 0,
      name: "local simulation",
      token: chain().addresses.usdc.toLowerCase(),
      explorer: null,
    };
  }
  const key = process.env.SPLIT_NETWORK ?? "base";
  const network =
    chainId != null
      ? Object.values(SPLIT_NETWORKS).find((value) => value.chainId === chainId)
      : key === "base" || key === "ethereum"
        ? SPLIT_NETWORKS[key]
        : undefined;
  invariant(network, "SPLIT_NETWORK_INVALID", "Select Base or Ethereum for USDC settlement.", 503);
  return network;
}
export function splitClient(chainId: number) {
  const network = Object.values(SPLIT_NETWORKS).find((value) => value.chainId === chainId);
  invariant(network, "SPLIT_NETWORK_INVALID", "Unsupported settlement network.", 503);
  const specific =
    chainId === 8453 ? process.env.SPLIT_BASE_RPC_URL : process.env.SPLIT_ETHEREUM_RPC_URL;
  const rpc =
    specific ?? (splitNetwork().chainId === chainId ? process.env.SPLIT_RPC_URL : undefined);
  invariant(rpc, "SPLIT_RPC_REQUIRED", "USDC settlement RPC is not configured.", 503);
  const url = new URL(rpc);
  invariant(
    url.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" && url.protocol === "http:"),
    "SPLIT_RPC_INVALID",
    "Settlement RPC must use HTTPS.",
    503,
  );
  return createPublicClient({
    chain: network.chain,
    transport: http(rpc, { timeout: 15_000, retryCount: 1 }),
  }) as PublicClient;
}
export async function splitMinimumBlock(chainId: number): Promise<string> {
  if (chainId === 0) {
    invariant(isDemo(), "SPLIT_SIMULATION_FORBIDDEN", "Simulated payments are local only.", 503);
    return "0";
  }
  const client = splitClient(chainId);
  invariant(
    (await client.getChainId()) === chainId,
    "WRONG_CHAIN",
    "Settlement RPC is on the wrong network.",
    503,
  );
  return ((await client.getBlockNumber({ cacheTime: 0 })) + 1n).toString();
}
export interface SplitObligation {
  chainId: number;
  token: string;
  payer: string;
  recipient: string;
  amount: bigint;
  minBlock: bigint;
}
export interface SplitEvidence {
  settlementKey: string;
  txHash: string;
  blockNumber: string;
}
export function splitCalldata(obligation: Pick<SplitObligation, "recipient" | "amount">) {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [obligation.recipient as Address, obligation.amount],
  });
}
export async function verifySplitTransfer(
  obligation: SplitObligation,
  hash: Hex,
  rpc?: PublicClient,
): Promise<SplitEvidence> {
  const network = splitNetwork(obligation.chainId);
  invariant(
    obligation.token.toLowerCase() === network.token,
    "WRONG_TOKEN",
    "The split must use native USDC.",
    409,
  );
  if (obligation.chainId === 0) {
    const transfer = await chain().erc20Transfer(hash);
    if (!transfer) throw new AppError("PENDING", "Transfer not seen yet.", 409, true);
    invariant(transfer.success, "TX_FAILED", "The transfer reverted.", 409);
    invariant(
      transfer.token.toLowerCase() === obligation.token.toLowerCase(),
      "WRONG_TOKEN",
      "Paid in the wrong token.",
      409,
    );
    invariant(
      transfer.from.toLowerCase() === obligation.payer.toLowerCase(),
      "WRONG_PAYER",
      "Paid from the wrong wallet.",
      409,
    );
    invariant(
      transfer.to.toLowerCase() === obligation.recipient.toLowerCase(),
      "WRONG_RECIPIENT",
      "Paid to the wrong address.",
      409,
    );
    invariant(
      transfer.amount === obligation.amount,
      "WRONG_AMOUNT",
      "The transfer must match the share exactly.",
      409,
    );
    if (!transfer.finalized) throw new AppError("PENDING", "Waiting for finality.", 409, true);
    return {
      settlementKey: "0:" + hash.toLowerCase(),
      txHash: hash.toLowerCase(),
      blockNumber: "0",
    };
  }
  const client = rpc ?? splitClient(obligation.chainId);
  invariant(
    (await client.getChainId()) === obligation.chainId,
    "WRONG_CHAIN",
    "Settlement RPC is on the wrong network.",
    503,
  );
  let receipt;
  let transaction;
  try {
    [receipt, transaction] = await Promise.all([
      client.getTransactionReceipt({ hash }),
      client.getTransaction({ hash }),
    ]);
  } catch {
    throw new AppError(
      "PENDING",
      "Transfer not available yet. Verification will retry.",
      409,
      true,
    );
  }
  invariant(receipt.status === "success", "TX_FAILED", "The transfer reverted.", 409);
  invariant(
    transaction.chainId == null || transaction.chainId === obligation.chainId,
    "WRONG_CHAIN",
    "The transaction belongs to a different network.",
    409,
  );
  invariant(
    receipt.transactionHash.toLowerCase() === hash.toLowerCase() &&
      transaction.hash.toLowerCase() === hash.toLowerCase(),
    "WRONG_TRANSACTION",
    "Transaction evidence does not match.",
    409,
  );
  invariant(
    receipt.blockNumber >= obligation.minBlock,
    "OLD_TRANSACTION",
    "This payment predates the split payment intent.",
    409,
  );
  invariant(
    transaction.from.toLowerCase() === obligation.payer.toLowerCase() &&
      receipt.from.toLowerCase() === obligation.payer.toLowerCase(),
    "WRONG_PAYER",
    "Paid from the wrong wallet.",
    409,
  );
  invariant(
    transaction.to?.toLowerCase() === obligation.token.toLowerCase() &&
      receipt.to?.toLowerCase() === obligation.token.toLowerCase(),
    "WRONG_TOKEN",
    "The payment must directly transfer native USDC.",
    409,
  );
  invariant(
    transaction.value === 0n &&
      transaction.input.toLowerCase() === splitCalldata(obligation).toLowerCase(),
    "WRONG_TRANSFER",
    "The transfer does not match the exact USDC obligation.",
    409,
  );
  const transfers = receipt.logs.flatMap((log) => {
    if (log.address.toLowerCase() !== obligation.token.toLowerCase()) return [];
    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        eventName: "Transfer",
        data: log.data,
        topics: log.topics,
        strict: true,
      });
      return [{ ...decoded.args, removed: log.removed }];
    } catch {
      return [];
    }
  });
  invariant(
    transfers.length === 1 &&
      !transfers[0].removed &&
      transfers[0].from.toLowerCase() === obligation.payer.toLowerCase() &&
      transfers[0].to.toLowerCase() === obligation.recipient.toLowerCase() &&
      transfers[0].value === obligation.amount,
    "WRONG_TRANSFER",
    "No matching USDC transfer was found.",
    409,
  );
  const [canonical, finalized] = await Promise.all([
    client.getBlock({ blockNumber: receipt.blockNumber }),
    client.getBlock({ blockTag: "finalized" }),
  ]);
  if (
    canonical.hash !== receipt.blockHash ||
    transaction.blockNumber !== receipt.blockNumber ||
    transaction.blockHash !== receipt.blockHash ||
    finalized.number == null ||
    finalized.number < receipt.blockNumber
  )
    throw new AppError("PENDING", "Waiting for canonical finalized settlement.", 409, true);
  return {
    settlementKey: obligation.chainId + ":" + hash.toLowerCase(),
    txHash: hash.toLowerCase(),
    blockNumber: receipt.blockNumber.toString(),
  };
}
