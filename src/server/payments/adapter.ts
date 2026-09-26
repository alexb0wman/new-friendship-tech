import { randomBytes, randomUUID } from "node:crypto";
import { isDemo, config } from "@/server/config";
import { AppError, invariant } from "@/server/errors";
import type { Obligation, SettlementEvidence } from "./verification";
import {
  merchantConfiguration,
  quoteMerchant,
  merchantFromQuote,
  merchantRequest,
  orderSchema,
  validateOrder,
} from "./merchant";
import { proveSource, proveNativeDestination } from "./chain-proof";
import { z } from "zod";
import * as s from "@/server/db/schema";
import { applyWrite } from "@/server/db/write";
import { eq } from "drizzle-orm";
import type { MerchantPayment } from "@/lib/payment-types";
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
async function recoverOrder(payment: MerchantPayment, sourceTx: string) {
  let cursor: number | undefined;
  for (let page = 0; page < 5; page++) {
    const list = z
      .object({ data: z.array(z.unknown()), cursor: z.number().optional() })
      .parse(
        await merchantRequest(
          "/v1/orders/" +
            encodeURIComponent(payment.sourceWallet) +
            "?limit=100" +
            (cursor === undefined ? "" : "&cursor=" + cursor),
        ),
      );
    for (const candidate of list.data) {
      const raw = candidate as Record<string, unknown>;
      if (
        raw?.quoteId !== payment.providerQuoteId ||
        raw?.routeId !== payment.routeId ||
        String(raw.depositTxHash).toLowerCase() !== sourceTx.toLowerCase()
      )
        continue;
      const order = orderSchema.parse(
        await merchantRequest("/v1/orders/by-id/" + encodeURIComponent(String(raw.id))),
      );
      validateOrder(order, payment, sourceTx);
      return order;
    }
    if (list.cursor === undefined || list.cursor === cursor) return null;
    cursor = list.cursor;
  }
  throw new AppError(
    "PAYMENT_ORDER_LOOKUP_LIMIT",
    "Order recovery requires support review. Do not pay again.",
    409,
  );
}
async function boundOrder(invoice: InvoiceRow, payment: MerchantPayment) {
  const sourceTx = invoice.sourceTx!;
  let order;
  if (invoice.providerOrderId) {
    order = orderSchema.parse(
      await merchantRequest("/v1/orders/by-id/" + encodeURIComponent(invoice.providerOrderId)),
    );
    invariant(
      order.id === invoice.providerOrderId,
      "WRONG_ORDER",
      "Provider returned another order.",
      409,
    );
    return order;
  }
  // A previous process may have registered the order and stopped before persisting its ID.
  order = await recoverOrder(payment, sourceTx);
  if (!order) {
    try {
      const submitted = z.object({ orderId: z.string().min(1).max(160), txHash: z.string() }).parse(
        await merchantRequest("/v1/deposit/submit", "PUT", {
          quoteId: payment.providerQuoteId,
          routeId: payment.routeId,
          txHash: sourceTx,
        }),
      );
      invariant(
        submitted.txHash.toLowerCase() === sourceTx.toLowerCase(),
        "WRONG_SOURCE_TX",
        "Provider returned a different source transaction.",
        409,
      );
      order = orderSchema.parse(
        await merchantRequest("/v1/orders/by-id/" + encodeURIComponent(submitted.orderId)),
      );
      invariant(
        order.id === submitted.orderId,
        "WRONG_ORDER",
        "Provider returned another order.",
        409,
      );
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "PAYMENT_PROVIDER_UNAVAILABLE")
        throw error;
      order = await recoverOrder(payment, sourceTx);
      if (!order) throw error;
    }
  }
  validateOrder(order, payment, sourceTx);
  const orderId = order.id;
  await applyWrite(null, "payment.order.bound", invoice.id, async (tx) => {
    const [fresh] = await tx
      .select()
      .from(s.invoices)
      .where(eq(s.invoices.id, invoice.id))
      .for("update");
    invariant(
      fresh &&
        fresh.sourceTx === sourceTx &&
        fresh.quote.providerQuoteId === payment.providerQuoteId,
      "WRONG_QUOTE",
      "Invoice changed during order registration.",
      409,
    );
    invariant(
      !fresh.providerOrderId || fresh.providerOrderId === orderId,
      "WRONG_ORDER",
      "Invoice already has another order.",
      409,
    );
    await tx
      .update(s.invoices)
      .set({ providerOrderId: orderId })
      .where(eq(s.invoices.id, invoice.id));
  });
  return order;
}
class OgPayMerchantAdapter implements PaymentAdapter {
  name = "0g-pay";
  async quote(sourceWallet: string, usdCents: number) {
    invariant(
      config().checkoutEnabled && process.env.PAYMENT_PROVIDER === "0g-pay",
      "PAYMENT_ROUTE_UNVERIFIED",
      "0G Pay checkout is not enabled.",
      503,
    );
    return quoteMerchant(sourceWallet, usdCents);
  }
  async inspect(invoice: InvoiceRow): Promise<SettlementEvidence | null> {
    const payment = merchantFromQuote(invoice.quote as Obligation);
    if (!invoice.sourceTx) return null;
    const source = await proveSource(payment, invoice.sourceTx);
    if (!source) return null;
    const order = await boundOrder(invoice, payment);
    validateOrder(order, payment, invoice.sourceTx);
    if (["refunded", "refund_pending", "failed"].includes(order.status)) {
      throw new AppError(
        "PAYMENT_" + order.status.toUpperCase(),
        "The provider payment requires review. Do not pay again until its refund or settlement is confirmed.",
        409,
      );
    }
    if (!source.finalized || order.status !== "filled" || !order.transactions?.fill) return null;
    const destinationTx = order.transactions.fill.txHash;
    const destination = await proveNativeDestination(payment, destinationTx);
    if (!destination) return null;
    return {
      chainId: payment.destinationChainId,
      asset: invoice.quote.asset,
      recipient: payment.recipient,
      amount: destination.amount,
      sourceWallet: order.author,
      providerQuoteId: order.quoteId,
      txHash: destinationTx,
      settlementIndex: "native:" + payment.recipient,
      success: true,
      finalized: destination.finalized,
    };
  }
}
export function paymentAdapter(provider?: string): PaymentAdapter {
  if (isDemo() && (!provider || provider === "demo")) return new DemoAdapter();
  invariant(
    provider === undefined || provider === "0g-pay",
    "PROVIDER_MISMATCH",
    "This payment provider cannot verify the invoice.",
    409,
  );
  return new OgPayMerchantAdapter();
}
export function checkoutStatus() {
  if (isDemo()) return { enabled: true, demo: true, reason: "Local simulation. No funds move." };
  if (!config().checkoutEnabled || process.env.PAYMENT_PROVIDER !== "0g-pay")
    return { enabled: false, demo: false, reason: "Live checkout has not opened yet." };
  try {
    merchantConfiguration();
    return {
      enabled: true,
      demo: false,
      reason:
        "Pay 19 USDC on Base through 0G Pay's TokenFlight route. Treasury settlement is native 0G. Network gas is additional.",
    };
  } catch {
    return {
      enabled: false,
      demo: false,
      reason: "0G Pay treasury and mainnet verification are not configured.",
    };
  }
}
export function demoTransactionHash() {
  invariant(isDemo(), "NOT_FOUND", "Not found.", 404);
  return "0x" + randomBytes(32).toString("hex");
}
