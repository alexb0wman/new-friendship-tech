import { describe, it, expect, afterEach, vi } from "vitest";
import { encodeFunctionData, erc20Abi, zeroAddress } from "viem";
import {
  validateBuild,
  validateOrder,
  BASE_USDC,
  quoteMerchant,
  merchantFromQuote,
  merchantConfiguration,
  type MerchantOrder,
} from "@/server/payments/merchant";
import {
  nativeReceived,
  validateSourceProof,
  readProvenTransaction,
  type ProvenTransaction,
} from "@/server/payments/chain-proof";
import { checkoutStatus, paymentAdapter } from "@/server/payments/adapter";
import type { MerchantPayment } from "@/lib/payment-types";

const wallet = "0x" + "1".repeat(40),
  treasury = "0x" + "2".repeat(40),
  contract = "0x" + "3".repeat(40);
const txHash = "0x" + "4".repeat(64),
  blockHash = "0x" + "5".repeat(64);
const topic = (address: string) => "0x" + address.slice(2).padStart(64, "0");
const transfer = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const payment: MerchantPayment = {
  version: 1,
  sourceChainId: 8453,
  sourceToken: BASE_USDC,
  sourceAmount: "19000000",
  sourceWallet: wallet,
  destinationChainId: 16661,
  recipient: treasury,
  minimumOutput: "995000000000000000",
  estimatedOutput: "1000000000000000000",
  providerQuoteId: "quote-1",
  routeId: "route-1",
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
const order: MerchantOrder = {
  id: "order-1",
  quoteId: payment.providerQuoteId,
  routeId: payment.routeId,
  author: wallet,
  recipient: treasury,
  fromChainId: 8453,
  toChainId: 16661,
  fromToken: BASE_USDC,
  toToken: zeroAddress,
  srcAmount: "19000000",
  destAmount: payment.minimumOutput,
  status: "filled",
  depositTxHash: txHash,
  tradeType: "EXACT_INPUT",
  transactions: { fill: { txHash, chainId: 16661 } },
};
function source(): ProvenTransaction {
  return {
    tx: {
      hash: txHash,
      from: wallet,
      to: contract,
      input: payment.transactions[0].data,
      value: "0x0",
      blockHash,
      blockNumber: "0x10",
    },
    receipt: {
      transactionHash: txHash,
      blockHash,
      blockNumber: "0x10",
      status: "0x1",
      logs: [
        {
          address: BASE_USDC,
          topics: [transfer, topic(wallet), topic(contract)],
          data: "0x" + 19000000n.toString(16).padStart(64, "0"),
        },
      ],
    },
    timestamp: Date.parse("2026-09-26T10:01:00Z"),
    finalized: true,
    blockTag: "0x10",
  };
}
function env() {
  vi.stubEnv("PAYMENT_RECIPIENT", treasury);
  vi.stubEnv("PAYMENT_SOURCE_RPC_URL", "https://base.example");
  vi.stubEnv("PAYMENT_RPC_URL", "https://og.example");
  vi.stubEnv("PAYMENT_CONFIRMATIONS", "12");
  vi.stubEnv("PAYMENT_SOURCE_CONFIRMATIONS", "12");
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe("merchant source authorization", () => {
  const request = (to: string, data: string, deposit = false, value = "0x0") => ({
    type: "eip1193_request",
    deposit,
    request: {
      method: "eth_sendTransaction",
      params: [{ from: wallet, to, data, value, chainId: "0x2105" }],
    },
  });
  const approval = (amount = 19000000n, spender = contract) =>
    request(
      BASE_USDC,
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender as `0x${string}`, amount],
      }),
    );
  it("allows bounded approval and a single contract deposit", () => {
    const result = validateBuild(
      { kind: "CONTRACT_CALL", approvals: [approval(), request(contract, "0xabcdef010001", true)] },
      wallet,
      "19000000",
    );
    expect(result).toHaveLength(2);
    expect(result[1].deposit).toBe(true);
  });
  it.each([
    ["unlimited approval", () => approval(2n ** 256n - 1n)],
    ["unrelated spender", () => approval(19000000n, treasury)],
    ["native charge", () => request(contract, "0xabcdef010001", false, "0x1")],
    [
      "token transfer masquerading as approval",
      () =>
        request(
          BASE_USDC,
          encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [treasury as `0x${string}`, 19000000n],
          }),
        ),
    ],
  ])("rejects %s", (_label, bad) => {
    expect(() =>
      validateBuild(
        { kind: "CONTRACT_CALL", approvals: [bad(), request(contract, "0xabcdef010001", true)] },
        wallet,
        "19000000",
      ),
    ).toThrow();
  });
  it("rejects an injected signing method or a second deposit", () => {
    expect(() =>
      validateBuild(
        {
          kind: "CONTRACT_CALL",
          approvals: [
            { type: "eip1193_request", request: { method: "eth_signTypedData_v4", params: [] } },
          ],
        },
        wallet,
        "19000000",
      ),
    ).toThrow();
    expect(() =>
      validateBuild(
        {
          kind: "CONTRACT_CALL",
          approvals: [
            request(contract, "0xabcdef010001", true),
            request(contract, "0xabcdef010001", true),
          ],
        },
        wallet,
        "19000000",
      ),
    ).toThrow();
  });
});
describe("independent source payment proof", () => {
  it("accepts exact calldata and real net USDC movement", () =>
    expect(() => validateSourceProof(payment, source())).not.toThrow());
  it("accepts a late browser return when mining occurred inside the original quote", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T11:00:00Z"));
    expect(Date.now()).toBeGreaterThan(Date.parse(payment.expiresAt));
    expect(() => validateSourceProof(payment, source())).not.toThrow();
  });
  it.each([{ from: treasury }, { to: treasury }, { input: "0xdeadbeef" }, { value: "0x1" }])(
    "rejects substituted source transaction %#",
    (change) => {
      const proof = source();
      Object.assign(proof.tx, change);
      expect(() => validateSourceProof(payment, proof)).toThrow();
    },
  );
  it("rejects wrong token, amount and receipt mined outside original quote", () => {
    const wrongToken = source();
    wrongToken.receipt.logs[0].address = treasury;
    expect(() => validateSourceProof(payment, wrongToken)).toThrow();
    const short = source();
    short.receipt.logs[0].data = "0x01";
    expect(() => validateSourceProof(payment, short)).toThrow();
    expect(() =>
      validateSourceProof(payment, { ...source(), timestamp: Date.parse(payment.expiresAt) + 1 }),
    ).toThrow();
    expect(() =>
      validateSourceProof(payment, {
        ...source(),
        timestamp: Date.parse(payment.quotedAt) - 60000,
      }),
    ).toThrow();
  });
});
describe("provider order binding", () => {
  it("accepts source-linked order and pending zero output", () => {
    expect(() => validateOrder(order, payment, txHash)).not.toThrow();
    expect(() =>
      validateOrder({ ...order, status: "deposited", destAmount: "0" }, payment, txHash),
    ).not.toThrow();
  });
  it.each([
    { quoteId: "other" },
    { routeId: "other" },
    { author: treasury },
    { refundTo: treasury },
    { recipient: wallet },
    { fromChainId: 1 },
    { toChainId: 1 },
    { fromToken: treasury },
    { toToken: BASE_USDC },
    { srcAmount: "18000000" },
    { destAmount: "1" },
    { depositTxHash: blockHash },
    { tradeType: "EXACT_OUTPUT" },
    { transactions: { fill: { txHash, chainId: 1 } } },
  ])("rejects unrelated order fields %#", (change) =>
    expect(() => validateOrder({ ...order, ...change }, payment, txHash)).toThrow(),
  );
  it("refuses legacy unbound quotes", () =>
    expect(() =>
      merchantFromQuote({
        chainId: 16661,
        recipient: treasury,
        asset: zeroAddress,
        amount: "1",
        sourceWallet: wallet,
        providerQuoteId: "x",
      }),
    ).toThrow());
});
describe("native 0G settlement traces", () => {
  it("counts successful native transfer and subtracts treasury outflows", () => {
    expect(
      nativeReceived(
        {
          type: "CALL",
          from: contract,
          to: contract,
          value: "0x0",
          calls: [
            { type: "CALL", from: contract, to: treasury, value: "0x64" },
            { type: "CALL", from: treasury, to: wallet, value: "0x14" },
          ],
        },
        treasury,
      ),
    ).toBe(80n);
  });
  it("ignores reverted subtrees, delegatecall inherited value and self payments", () => {
    expect(
      nativeReceived(
        {
          type: "CALL",
          calls: [
            {
              type: "CALL",
              error: "execution reverted",
              calls: [{ type: "CALL", from: contract, to: treasury, value: "0x64" }],
            },
            { type: "DELEGATECALL", from: contract, to: treasury, value: "0x64" },
            { type: "CALL", from: treasury, to: treasury, value: "0x64" },
          ],
        },
        treasury,
      ),
    ).toBe(0n);
  });
});
describe("mainnet RPC and configured checkout", () => {
  it("keeps checkout closed for disabled provider and unsafe finality configuration", () => {
    env();
    vi.stubEnv("APP_MODE", "production");
    vi.stubEnv("CHECKOUT_ENABLED", "true");
    vi.stubEnv("PAYMENT_PROVIDER", "disabled");
    expect(checkoutStatus().enabled).toBe(false);
    vi.stubEnv("PAYMENT_PROVIDER", "0g-pay");
    expect(checkoutStatus().enabled).toBe(true);
    vi.stubEnv("PAYMENT_CONFIRMATIONS", "0");
    expect(checkoutStatus().enabled).toBe(false);
    expect(() => merchantConfiguration()).toThrow();
  });
  it("requires correct RPC network and canonical receipt block", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        const { method } = JSON.parse(String(init.body));
        return Response.json({ result: method === "eth_chainId" ? "0x1" : null });
      }),
    );
    await expect(
      readProvenTransaction("https://base.example", 8453, txHash, 12),
    ).rejects.toHaveProperty("code", "WRONG_CHAIN");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        const { method } = JSON.parse(String(init.body));
        const p = source();
        return Response.json({
          result: (
            {
              eth_chainId: "0x2105",
              eth_getTransactionByHash: p.tx,
              eth_getTransactionReceipt: {
                ...p.receipt,
                logs: [...p.receipt.logs, { address: contract, topics: [], data: "0x" }],
              },
              eth_blockNumber: "0x30",
              eth_getBlockByNumber: { hash: txHash, number: "0x10", timestamp: "0x65000000" },
            } as Record<string, unknown>
          )[method],
        });
      }),
    );
    await expect(
      readProvenTransaction("https://base.example", 8453, txHash, 12),
    ).rejects.toHaveProperty("code", "PAYMENT_REORG");
  });
  it("checks EOA treasury before issuing a quote or wallet request", async () => {
    env();
    const fetcher = vi.fn(async (url, init) => {
      const { method } = JSON.parse(String(init.body));
      return Response.json({
        result:
          method === "eth_getCode" ? "0x6000" : String(url).includes("base") ? "0x2105" : "0x4115",
      });
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(quoteMerchant(wallet, 1900)).rejects.toHaveProperty(
      "code",
      "UNSUPPORTED_TREASURY",
    );
    expect(fetcher.mock.calls.every(([url]) => !String(url).includes("hyperstream"))).toBe(true);
  });
});
