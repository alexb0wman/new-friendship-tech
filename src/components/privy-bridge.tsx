"use client";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, type ReactNode } from "react";
import { defineChain, type EIP1193Provider } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { SessionController } from "./session";
const zeroG = defineChain({
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc.0g.ai"] } },
  blockExplorers: { default: { name: "0G Explorer", url: "https://chainscan.0g.ai" } },
});
export default function PrivyBridge({ appId, children }: { appId: string; children: ReactNode }) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: { theme: "dark", accentColor: "#C7FF97", logo: "/wordmark.svg" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        supportedChains: [mainnet, zeroG, sepolia],
      }}
    >
      <Bridge>{children}</Bridge>
    </PrivyProvider>
  );
}
function Bridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, getAccessToken, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const provider = useCallback(
    async (address?: string): Promise<EIP1193Provider> => {
      const wallet = address
        ? wallets.find((item) => item.address.toLowerCase() === address.toLowerCase())
        : (wallets.find((item) => item.walletClientType === "privy") ?? wallets[0]);
      if (!wallet) throw new Error("Connect a wallet first.");
      return (await wallet.getEthereumProvider()) as EIP1193Provider;
    },
    [wallets],
  );
  return (
    <SessionController
      demo={false}
      authReady={ready}
      authRevision={authenticated ? (user?.id ?? "") : "guest"}
      getToken={getAccessToken}
      onLogin={login}
      onLogout={logout}
      getProvider={provider}
    >
      {children}
    </SessionController>
  );
}
