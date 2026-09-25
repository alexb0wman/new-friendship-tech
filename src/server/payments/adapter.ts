import { randomBytes, randomUUID } from "node:crypto";
import { isDemo, config } from "@/server/config";
import { AppError, invariant } from "@/server/errors";
import type { Obligation, SettlementEvidence } from "./verification";
import { readOgTransfer } from "./og-chain";
import type { invoices } from "@/server/db/schema";
export type InvoiceRow = typeof invoices.$inferSelect;
export interface PaymentAdapter {
  name: string;
  quote(userWallet: string, usdCents: number): Promise<{ obligation: Obligation; expiresAt: Date }>;
  inspect(invoice: InvoiceRow): Promise<SettlementEvidence | null>;
}
class DemoAdapter implements PaymentAdapter {
  name = "demo";
  async quote(sourceWallet: string, usdCents: number) {
    invariant(isDemo(), "NOT_FOUND", "Not found.", 404);
    return {
      obligation: {
        chainId: 0,
        recipient: "local-demo-only",
        asset: "DEMO_CENTS",
        amount: String(usdCents),
        sourceWallet,
        providerQuoteId: randomUUID(),
      },
      expiresAt: new Date(Date.now() + 10 * 60000),
    };
  }
  async inspect(invoice: InvoiceRow) {
    invariant(
      isDemo() && invoice.provider === "demo",
      "PROVIDER_MISMATCH",
      "Demo payments cannot verify real invoices.",
      409,
    );
    if (!invoice.sourceTx) return null;
    return {
      ...invoice.quote,
      txHash: invoice.sourceTx,
      settlementIndex: "demo",
      success: true,
      finalized: true,
    };
  }
}
class OgPayMerchantAdapter implements PaymentAdapter {
  name = "0g-pay";
  async quote(_sourceWallet: string, _usdCents: number): Promise<never> {
    // The SDK supports developer-mode recipients, but the published REST funding API
    // does not establish merchant invoice binding. Never invent that bridge.
    throw new AppError(
      "PAYMENT_ROUTE_UNVERIFIED",
      "Live checkout is being configured. No payment has been requested.",
      503,
    );
  }
  async inspect(invoice: InvoiceRow): Promise<SettlementEvidence | null> {
    const recipient = process.env.PAYMENT_RECIPIENT?.toLowerCase();
    if (!invoice.sourceTx || !recipient) {
      throw new AppError(
        "PAYMENT_ROUTE_UNVERIFIED",
        "Merchant settlement verification is not configured.",
        503,
        true,
      );
    }
    const seen = await readOgTransfer(invoice.sourceTx);
    if (!seen) return null;
    const paid =
      seen.token && seen.token.to === recipient
        ? { asset: seen.token.asset, amount: seen.token.amount, from: seen.token.from }
        : seen.nativeTo === recipient
          ? { asset: "0g", amount: seen.nativeAmount, from: seen.from }
          : null;
    if (!paid || paid.from !== invoice.quote.sourceWallet.toLowerCase()) {
      throw new AppError("WRONG_RECIPIENT", "The transaction did not pay the configured treasury.", 409);
    }
    return {
      chainId: seen.chainId,
      recipient,
      asset: paid.asset,
      amount: paid.amount,
      sourceWallet: paid.from,
      providerQuoteId: invoice.quote.providerQuoteId,
      txHash: seen.txHash,
      settlementIndex: `og:${seen.txHash}`,
      success: seen.success,
      finalized: seen.finalized,
    };
  }
}
export function paymentAdapter(provider?: string): PaymentAdapter {
  if (isDemo() && (!provider || provider === "demo")) return new DemoAdapter();
  invariant(
    provider !== "demo",
    "PROVIDER_MISMATCH",
    "Demo invoices are invalid in production.",
    409,
  );
  return new OgPayMerchantAdapter();
}
export function checkoutStatus() {
  if (isDemo()) return { enabled: true, demo: true, reason: "Local simulation. No funds move." };
  // Keep this fail-closed until the real adapter has its own integration evidence.
  return {
    enabled: false,
    demo: false,
    reason: config().checkoutEnabled
      ? "Merchant verification is not yet configured."
      : "Live checkout has not opened yet.",
  };
}
export function demoTransactionHash() {
  invariant(isDemo(), "NOT_FOUND", "Not found.", 404);
  return "0x" + randomBytes(32).toString("hex");
}
