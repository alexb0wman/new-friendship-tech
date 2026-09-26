import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { zeroAddress } from "viem";
import { paymentAdapter, type InvoiceRow } from "@/server/payments/adapter";
import { BASE_USDC } from "@/server/payments/merchant";
import type { MerchantPayment } from "@/lib/payment-types";

const db = vi.hoisted(() => ({ invoice: {} as Record<string, unknown>, writes: 0 }));
vi.mock("@/server/db/write", () => ({
  applyWrite: async (
    _actor: unknown,
    _action: unknown,
    _id: unknown,
    work: (tx: unknown) => Promise<unknown>,
  ) =>
    work({
      select: () => ({ from: () => ({ where: () => ({ for: async () => [db.invoice] }) }) }),
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            Object.assign(db.invoice, values);
            db.writes++;
          },
        }),
      }),
    }),
}));
vi.mock("@/server/payments/chain-proof", () => ({
  proveSource: async () => ({ finalized: true }),
  proveNativeDestination: async () => ({ amount: "1000", finalized: true }),
}));
const wallet = "0x" + "1".repeat(40),
  recipient = "0x" + "2".repeat(40),
  contract = "0x" + "3".repeat(40);
const sourceTx = "0x" + "4".repeat(64),
  destinationTx = "0x" + "5".repeat(64);
const payment: MerchantPayment = {
  version: 1,
  sourceChainId: 8453,
  sourceToken: BASE_USDC,
  sourceAmount: "19000000",
  sourceWallet: wallet,
  destinationChainId: 16661,
  recipient,
  minimumOutput: "1000",
  estimatedOutput: "1000",
  providerQuoteId: "quote",
  routeId: "route",
  quotedAt: "2026-09-26T10:00:00Z",
  expiresAt: "2026-09-26T10:05:00Z",
  transactions: [
    {
      from: wallet,
      to: contract,
      data: "0xabcdef010001",
      value: "0x0",
      chainId: "0x2105",
      deposit: true,
    },
  ],
};
const quote = {
  chainId: 16661,
  asset: zeroAddress,
  recipient,
  amount: "1000",
  sourceWallet: wallet,
  providerQuoteId: "quote",
  merchant: payment,
};
const order = {
  id: "provider-order",
  quoteId: "quote",
  routeId: "route",
  author: wallet,
  recipient,
  fromChainId: 8453,
  toChainId: 16661,
  fromToken: BASE_USDC,
  toToken: zeroAddress,
  srcAmount: "19000000",
  destAmount: "1000",
  status: "filled",
  depositTxHash: sourceTx,
  tradeType: "EXACT_INPUT",
  transactions: { fill: { txHash: destinationTx, chainId: 16661 } },
};
function invoice(): InvoiceRow {
  return {
    id: "invoice",
    userId: "user",
    quote,
    sourceTx,
    provider: "0g-pay",
    providerOrderId: null,
    status: "submitted",
    quoteExpiresAt: new Date(payment.expiresAt),
    createdAt: new Date(payment.quotedAt),
    idempotencyKey: "key",
    planVersion: 1,
    usdCents: 1900,
    destinationTx: null,
    settledAt: null,
    failureCode: null,
  };
}
beforeEach(() => {
  db.invoice = invoice() as unknown as Record<string, unknown>;
  db.writes = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("provider order restart recovery", () => {
  it("recovers an order after submission was processed but its response was lost", async () => {
    let submitted = false;
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes("/v1/deposit/submit")) {
        submitted = true;
        throw new Error("response lost");
      }
      if (url.includes("/v1/orders/by-id/")) return Response.json(order);
      if (url.includes("/v1/orders/")) return Response.json({ data: submitted ? [order] : [] });
      throw new Error("Unexpected provider URL");
    });
    vi.stubGlobal("fetch", fetcher);
    const evidence = await paymentAdapter("0g-pay").inspect(invoice());
    expect(evidence?.txHash).toBe(destinationTx);
    expect(db.invoice.providerOrderId).toBe("provider-order");
    expect(db.writes).toBe(1);
    expect(fetcher.mock.calls.filter(([url]) => url.includes("/v1/deposit/submit"))).toHaveLength(
      1,
    );
  });
  it("polls the persisted pending order without submitting again after a restart", async () => {
    let filled = false;
    const saved = { ...invoice(), providerOrderId: order.id };
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toContain("/v1/orders/by-id/provider-order");
      return Response.json(
        filled ? order : { ...order, status: "deposited", destAmount: "0", transactions: {} },
      );
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await paymentAdapter("0g-pay").inspect(saved)).toBeNull();
    filled = true;
    expect((await paymentAdapter("0g-pay").inspect(saved))?.txHash).toBe(destinationTx);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(db.writes).toBe(0);
  });
  it("finds an existing matching order before any re-submission", async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes("/by-id/") ? Response.json(order) : Response.json({ data: [order] }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect((await paymentAdapter("0g-pay").inspect(invoice()))?.settlementIndex).toBe(
      "native:" + recipient,
    );
    expect(fetcher.mock.calls.some(([url]) => url.includes("deposit/submit"))).toBe(false);
    expect(db.invoice.providerOrderId).toBe(order.id);
  });
});
