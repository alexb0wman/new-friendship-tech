import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Invoice } from "@/lib/types";
import { PLAN } from "@/lib/constants";
import { formatUsd } from "@/lib/money";

const state = vi.hoisted(() => ({
  invoice: null as Invoice | null,
  history: [] as Invoice[],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/session", () => ({
  ApiError: class extends Error {},
  useSession: () => ({
    me: {
      walletAddresses: ["0x" + "1".repeat(40), "0x" + "2".repeat(40)],
      membership: { active: false },
    },
    ready: true,
    config: { demo: false, checkout: { enabled: true } },
    api: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    walletProvider: vi.fn(),
  }),
  useResource: (path: string) => ({
    data: path === "invoices" ? { items: state.history } : state.invoice,
    error: null,
    loading: false,
    reload: vi.fn(),
  }),
}));
import { CheckoutView, MembershipView } from "@/components/views/membership";

function quotedInvoice(usdCents = PLAN.usdCents): Invoice {
  return {
    id: "invoice-for-rendering",
    status: "quoted",
    usdCents,
    quoteExpiresAt: "2030-01-01T00:10:00.000Z",
    createdAt: "2030-01-01T00:00:00.000Z",
    settledAt: null,
    sourceTx: null,
    destinationTx: null,
    failureCode: null,
    provider: "0g-pay",
    demo: false,
    payment: {
      version: 1,
      sourceChainId: 8453,
      sourceToken: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      sourceAmount: String(usdCents * 10000),
      sourceWallet: "0x" + "1".repeat(40),
      destinationChainId: 16661,
      recipient: "0x" + "3".repeat(40),
      minimumOutput: "1000000000000000000",
      estimatedOutput: "1100000000000000000",
      providerQuoteId: "server-owned-quote",
      routeId: "server-owned-route",
      transactions: [],
      quotedAt: "2030-01-01T00:00:00.000Z",
      expiresAt: "2030-01-01T00:10:00.000Z",
    },
  };
}

beforeEach(() => {
  state.invoice = quotedInvoice();
  state.history = [];
});

describe("membership checkout rendering", () => {
  it("mounts the live payment action and exposes the server-owned source obligation", () => {
    const html = renderToStaticMarkup(createElement(CheckoutView, { id: state.invoice!.id }));
    expect(html).toContain(`Pay ${PLAN.usdCents / 100} USDC with 0G Pay`);
    expect(html).toContain(`You pay ${PLAN.usdCents / 100} USDC on Base.`);
    expect(html).toContain(state.invoice!.payment!.sourceWallet);
    expect(html).toContain(state.invoice!.payment!.recipient);
    expect(html).not.toContain("Complete demo purchase");
  });

  it("preserves historical invoice prices after the current plan changes", () => {
    state.invoice = quotedInvoice(1900);
    state.history = [state.invoice];
    const checkout = renderToStaticMarkup(createElement(CheckoutView, { id: state.invoice.id }));
    expect(checkout).toContain("<strong>$19.00</strong>");
    expect(checkout).toContain("Pay 19 USDC with 0G Pay");
    expect(checkout).not.toContain("$39.00");
    const membership = renderToStaticMarkup(createElement(MembershipView));
    expect(membership).toContain(formatUsd(PLAN.usdCents));
    expect(membership).toContain("· $19");
    expect(membership).toContain("Paying wallet");
    expect(membership).toContain("0x" + "2".repeat(40));
  });

  it("offers deposit-hash recovery after expiry without another payment action", () => {
    state.invoice!.status = "expired";
    const html = renderToStaticMarkup(createElement(CheckoutView, { id: state.invoice!.id }));
    expect(html).toContain("Base transaction hash");
    expect(html).toContain("Resume verification");
    expect(html).toContain("Do not pay twice");
    expect(html).not.toContain("USDC with 0G Pay");
  });

  it("keeps local simulation separate and suppresses repeated payment on settlement", () => {
    state.invoice = { ...quotedInvoice(), demo: true, provider: "demo", payment: null };
    const demo = renderToStaticMarkup(createElement(CheckoutView, { id: state.invoice.id }));
    expect(demo).toContain("Complete demo purchase");
    expect(demo).not.toContain("USDC with 0G Pay");
    state.invoice = { ...quotedInvoice(), status: "settled" };
    const settled = renderToStaticMarkup(createElement(CheckoutView, { id: state.invoice.id }));
    expect(settled).toContain("You&#x27;re in.");
    expect(settled).not.toContain("USDC with 0G Pay");
    expect(settled).not.toContain("Resume verification");
  });
});
