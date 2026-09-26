import { isAddress, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { productionRequirements } from "./config";

export interface IntegrationCheck {
  name: string;
  network: string;
  status: "configuration_ready" | "blocked";
  missing: string[];
}

/** Configuration only. Never equate configured credentials with a successful live transaction. */
export function integrationReadiness() {
  const env = process.env;
  const present = (name: string) => !!env[name]?.trim();
  const https = (name: string) => {
    try {
      const url = new URL(env[name] ?? "");
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  };
  const address = (name: string) =>
    isAddress(env[name] ?? "", { strict: false }) && env[name]?.toLowerCase() !== zeroAddress;
  const signingKey = (name: string) => {
    try {
      const value = env[name];
      if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) return false;
      privateKeyToAccount(value as `0x${string}`);
      return true;
    } catch {
      return false;
    }
  };
  const checks: IntegrationCheck[] = [];
  function check(name: string, network: string, requirements: Array<[string, boolean]>) {
    const missing = requirements.filter(([, passes]) => !passes).map(([label]) => label);
    checks.push({
      name,
      network,
      status: missing.length ? "blocked" : "configuration_ready",
      missing,
    });
  }
  check("runtime", "production", [
    ...productionRequirements().map((key): [string, boolean] => [key, false]),
    ["APP_ORIGIN (HTTPS)", https("APP_ORIGIN")],
    [
      "NEXT_PUBLIC_PRIVY_APP_ID matches PRIVY_APP_ID",
      present("NEXT_PUBLIC_PRIVY_APP_ID") && env.NEXT_PUBLIC_PRIVY_APP_ID === env.PRIVY_APP_ID,
    ],
  ]);
  const mainnet = (env.ENS_CHAIN_ID ?? "1") === "1";
  check("ens", mainnet ? "Ethereum mainnet" : "Sepolia", [
    ["ENS_ENABLED=true", env.ENS_ENABLED === "true"],
    ["ENS_CHAIN_ID (1 or 11155111)", ["1", "11155111"].includes(env.ENS_CHAIN_ID ?? "1")],
    [
      mainnet ? "ENS_MAINNET_RPC_URL (HTTPS)" : "ENS_SEPOLIA_RPC_URL (HTTPS)",
      https(mainnet ? "ENS_MAINNET_RPC_URL" : "ENS_SEPOLIA_RPC_URL"),
    ],
  ]);
  check("ensv2", "Sepolia only; mainnet unavailable", [
    ["ENS_SEPOLIA_RPC_URL (HTTPS)", https("ENS_SEPOLIA_RPC_URL")],
    ["ENS_PARENT_NAME", !!env.ENS_PARENT_NAME?.match(/^[^.]+\.eth$/)],
    ...["ENS_PARENT_REGISTRY", "ENS_CITY_REGISTRY_TOKYO", "ENS_APP_RESOLVER"].map(
      (key): [string, boolean] => [key, address(key)],
    ),
    ...["ENS_OPERATOR_PRIVATE_KEY", "ENS_CONCIERGE_PRIVATE_KEY"].map((key): [string, boolean] => [
      key,
      signingKey(key),
    ]),
    [
      "distinct ENS operator and concierge wallets",
      present("ENS_OPERATOR_PRIVATE_KEY") &&
        env.ENS_OPERATOR_PRIVATE_KEY?.toLowerCase() !==
          env.ENS_CONCIERGE_PRIVATE_KEY?.toLowerCase(),
    ],
  ]);
  check("world", "World ID production", [
    ["WORLD_APP_ID", /^app_[a-zA-Z0-9]+$/.test(env.WORLD_APP_ID ?? "")],
    ["WORLD_RP_ID", /^rp_[a-zA-Z0-9]+$/.test(env.WORLD_RP_ID ?? "")],
    ["WORLD_RP_SIGNING_KEY", /^(?:0x)?[0-9a-fA-F]{64}$/.test(env.WORLD_RP_SIGNING_KEY ?? "")],
    ["WORLD_ENVIRONMENT=production", env.WORLD_ENVIRONMENT === "production"],
  ]);
  check("0g-pay", "Base USDC → native 0G (16661)", [
    ["CHECKOUT_ENABLED=true", env.CHECKOUT_ENABLED === "true"],
    ["PAYMENT_PROVIDER=0g-pay", env.PAYMENT_PROVIDER === "0g-pay"],
    ["PAYMENT_RECIPIENT", address("PAYMENT_RECIPIENT")],
    ["PAYMENT_SOURCE_RPC_URL (HTTPS)", https("PAYMENT_SOURCE_RPC_URL")],
    ["PAYMENT_RPC_URL (HTTPS, call traces)", https("PAYMENT_RPC_URL")],
    [
      "PAYMENT_CONFIRMATIONS >= 12",
      /^\d+$/.test(env.PAYMENT_CONFIRMATIONS ?? "12") &&
        Number(env.PAYMENT_CONFIRMATIONS ?? "12") >= 12,
    ],
    [
      "PAYMENT_SOURCE_CONFIRMATIONS >= 12",
      /^\d+$/.test(env.PAYMENT_SOURCE_CONFIRMATIONS ?? "12") &&
        Number(env.PAYMENT_SOURCE_CONFIRMATIONS ?? "12") >= 12,
    ],
  ]);
  const splitNetwork = env.SPLIT_NETWORK ?? "base";
  check("bill-splits", splitNetwork === "ethereum" ? "Ethereum USDC" : "Base USDC", [
    ["SPLIT_NETWORK (base or ethereum)", ["base", "ethereum"].includes(splitNetwork)],
    [
      "SPLIT_RPC_URL or network-specific HTTPS RPC",
      https("SPLIT_RPC_URL") ||
        https(splitNetwork === "ethereum" ? "SPLIT_ETHEREUM_RPC_URL" : "SPLIT_BASE_RPC_URL"),
    ],
  ]);
  return {
    checkedAt: new Date().toISOString(),
    configurationReady: checks.every((item) => item.status === "configuration_ready"),
    liveExecutionVerified: false,
    ensv2MainnetAvailable: false,
    checks,
    note: "Configuration checks are not live execution evidence. ENSv2 remains Sepolia-only. Complete the launch spec and record actual transaction hashes before claiming launch.",
  };
}
