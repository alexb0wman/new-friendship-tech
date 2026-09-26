import { normalize } from "viem/ens";
import { zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { isDemo, previewEns } from "@/server/config";
import { AppError } from "@/server/errors";

/**
 * ENSv2 Sepolia beta deployment, from https://docs.ens.domains/learn/deployments#sepolia-ensv2-beta
 * (contracts-v2 commit 71a3b7339dbc55ab47667abdfe8303bac4f4c24e). The beta redeploys; re-check the
 * page on build day and before any live run. The Universal Resolver proxy is the same address on
 * mainnet and Sepolia and is what viem's sepolia chain config resolves through.
 */
export const SEPOLIA = {
  rootRegistry: "0x9703dbd26dab89504490994138cf2c575251a9ce",
  ethRegistry: "0x657ea849311d3d5823348dded7c2aaafb3ede09e",
  ethRegistrar: "0xabe76f6c8dfced81aa5a2bb8034202a7136b94ca",
  verifiableFactory: "0x9e726eb570beb6bceb495ab8cda7df517d4e841c",
  userRegistryImpl: "0xa80338aaa8d23831cea25e858d1774534abb0263",
  permissionedResolverImpl: "0x14f09fd05d4585759e54844dc9b00147131cf243",
  universalResolverV2: "0x5d25c1d6acbb71b7a28aa7899618a3412a8303e3",
  universalResolverProxy: "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe",
  universalHelper: "0x33f571aa8a160a21b877cf6e0fb8806692b97df5",
  mockUsdc: "0x16f95d91dba7da3aca778ec053df0ff6c6a8aa8e",
} as const;
export const DEMO_PARENT = "friendship-demo.eth";
/** ENSIP-11 coin type for an EVM chain: 0x80000000 + chainId. 0G mainnet is chain 16661. */
export const OG_COIN_TYPE = 0x80000000 + 16661;
export const ETH_COIN_TYPE = 60;

/** The `.eth` parent every trip, table and concierge name hangs off. Never hardcode it elsewhere. */
export function parentName(): string {
  const configured = process.env.ENS_PARENT_NAME?.trim();
  if (configured) {
    const name = normalize(configured);
    if (!name.endsWith(".eth") || name.split(".").length !== 2)
      throw new AppError(
        "ENS_PARENT_INVALID",
        "ENS_PARENT_NAME must be a second-level .eth name.",
        503,
      );
    return name;
  }
  if (isDemo() || previewEns()) return DEMO_PARENT;
  throw new AppError("ENS_UNAVAILABLE", "ENS_PARENT_NAME is not configured.", 503);
}
export const parentLabel = () => parentName().replace(/\.eth$/, "");

export interface EnsWorldEnv {
  rpcUrl: string;
  parentRegistry: string;
  cityRegistryTokyo: string;
  appResolver: string;
  operatorKey: `0x${string}`;
  conciergeKey: `0x${string}`;
}
/** Live Sepolia configuration, or null when any piece is missing (the adapter then reports ENS_UNAVAILABLE). */
export function ensWorldEnv(): EnsWorldEnv | null {
  const rpcUrl = process.env.ENS_SEPOLIA_RPC_URL,
    parentRegistry = process.env.ENS_PARENT_REGISTRY,
    cityRegistryTokyo = process.env.ENS_CITY_REGISTRY_TOKYO,
    appResolver = process.env.ENS_APP_RESOLVER,
    operatorKey = process.env.ENS_OPERATOR_PRIVATE_KEY,
    conciergeKey = process.env.ENS_CONCIERGE_PRIVATE_KEY;
  if (
    !rpcUrl ||
    !parentRegistry ||
    !cityRegistryTokyo ||
    !appResolver ||
    !operatorKey ||
    !conciergeKey
  )
    return null;
  const key = /^0x[0-9a-fA-F]{64}$/;
  if (!key.test(operatorKey) || !key.test(conciergeKey)) return null;
  const address = /^0x[0-9a-fA-F]{40}$/;
  if (![parentRegistry, cityRegistryTokyo, appResolver].every((value) => address.test(value)))
    return null;
  if (
    [parentRegistry, cityRegistryTokyo, appResolver].some(
      (value) => value.toLowerCase() === zeroAddress,
    )
  )
    return null;
  try {
    const rpc = new URL(rpcUrl);
    if (!["http:", "https:"].includes(rpc.protocol)) return null;
    if (process.env.NODE_ENV === "production" && rpc.protocol !== "https:") return null;
    const operator = privateKeyToAccount(operatorKey as `0x${string}`);
    const concierge = privateKeyToAccount(conciergeKey as `0x${string}`);
    if (operator.address === concierge.address) return null;
    parentName();
  } catch {
    return null;
  }
  return {
    rpcUrl,
    parentRegistry: parentRegistry.toLowerCase(),
    cityRegistryTokyo: cityRegistryTokyo.toLowerCase(),
    appResolver: appResolver.toLowerCase(),
    operatorKey: operatorKey as `0x${string}`,
    conciergeKey: conciergeKey as `0x${string}`,
  };
}
/** Sepolia explorer links. Null in demo mode, where nothing exists on a public chain. */
export function explorerName(name: string): string | null {
  if (isDemo() || previewEns()) return null;
  const template = process.env.ENS_EXPLORER_NAME_URL ?? "https://app.ens.dev/{name}";
  return template.replace("{name}", encodeURIComponent(name));
}
export function explorerTx(hash: string | null | undefined): string | null {
  if (!hash || isDemo() || previewEns()) return null;
  return "https://sepolia.etherscan.io/tx/" + hash;
}
