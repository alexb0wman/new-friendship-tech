"use client";
import { useEffect, useState } from "react";
import { formatUnits, type EIP1193Provider } from "viem";
import type { MerchantPayment } from "@/lib/payment-types";

type Hint = { sourceTx: string };
/** Server-built TokenFlight route used by 0G Pay. A wallet hash is only a reconciliation hint. */
export function OgPayTrigger({
  invoiceId,
  payment,
  walletProvider,
  onTransactionHint,
  onFailure,
}: {
  invoiceId: string;
  payment: MerchantPayment;
  walletProvider: (address?: string) => Promise<EIP1193Provider>;
  onTransactionHint: (hint: Hint) => Promise<void>;
  onFailure: (error: Error) => void;
}) {
  const [busy, setBusy] = useState(false),
    [pendingHash, setPendingHash] = useState<string | null>(null);
  const storageKey = "nft-payment:" + invoiceId;
  useEffect(() => {
    try {
      setPendingHash(localStorage.getItem(storageKey));
    } catch {
      /* The server still retains the invoice. */
    }
  }, [storageKey]);
  async function submitHint(hash: string) {
    await onTransactionHint({ sourceTx: hash });
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* Retrying a hint is idempotent. */
    }
  }
  async function pay() {
    if (busy) return;
    setBusy(true);
    try {
      if (pendingHash) return await submitHint(pendingHash);
      if (Date.parse(payment.expiresAt) <= Date.now())
        throw new Error("This quote has expired. No new payment was requested.");
      const provider = await walletProvider(payment.sourceWallet);
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x2105" }],
      });
      for (const tx of payment.transactions) {
        const accounts = await provider.request({ method: "eth_accounts" });
        const chainId = await provider.request({ method: "eth_chainId" });
        if (accounts[0]?.toLowerCase() !== payment.sourceWallet || Number(chainId) !== 8453)
          throw new Error("Select the quoted wallet on Base before paying.");
        if (Date.parse(payment.expiresAt) <= Date.now())
          throw new Error("This quote expired before deposit. No deposit was requested.");
        const hash = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: tx.from as `0x${string}`,
              to: tx.to as `0x${string}`,
              data: tx.data as `0x${string}`,
              value: tx.value as `0x${string}`,
            },
          ],
        });
        if (tx.deposit) {
          setPendingHash(hash);
          try {
            localStorage.setItem(storageKey, hash);
          } catch {
            /* The source hash is also shown in the wallet. */
          }
          await submitHint(hash);
          return;
        }
        // Do not send the deposit until a bounded USDC allowance has actually succeeded.
        const deadline = Date.now() + 120000;
        let confirmed = false;
        while (Date.now() < deadline) {
          const receipt = await provider.request({
            method: "eth_getTransactionReceipt",
            params: [hash],
          });
          if (receipt) {
            if (Number(receipt.status) !== 1)
              throw new Error("The USDC approval reverted. No deposit was requested.");
            confirmed = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        if (!confirmed)
          throw new Error(
            "USDC approval is still pending. Check the wallet before continuing; no deposit was requested.",
          );
      }
    } catch (error) {
      onFailure(
        error instanceof Error
          ? error
          : new Error("Payment did not complete. Check your wallet activity before paying again."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <button className="button lime full" disabled={busy} onClick={() => void pay()}>
      {busy
        ? "Waiting for wallet and verification…"
        : pendingHash
          ? "Resume payment verification"
          : `Pay ${formatUnits(BigInt(payment.sourceAmount), 6)} USDC with 0G Pay`}
    </button>
  );
}
