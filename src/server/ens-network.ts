import { mainnet, sepolia } from "viem/chains";
import { AppError } from "./errors";

/** Account names resolve on Ethereum by default. The ENSv2 namespace has its own Sepolia client. */
export function ensNetwork(chainId = Number(process.env.ENS_CHAIN_ID ?? "1")) {
  if (chainId === mainnet.id) return mainnet;
  if (chainId === sepolia.id) return sepolia;
  throw new AppError("ENS_CHAIN", "ENS_CHAIN_ID must be 1 (Ethereum) or 11155111 (Sepolia).", 503);
}

export function ensRpcUrl(chainId: number = ensNetwork().id) {
  ensNetwork(chainId);
  const value =
    chainId === mainnet.id ? process.env.ENS_MAINNET_RPC_URL : process.env.ENS_SEPOLIA_RPC_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null;
    return value;
  } catch {
    return null;
  }
}
