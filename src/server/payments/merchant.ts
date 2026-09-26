import { decodeFunctionData, erc20Abi, zeroAddress } from "viem";
import { z } from "zod";
import { invariant, AppError } from "@/server/errors";
import type { MerchantPayment, PaymentTransaction } from "@/lib/payment-types";
import type { Obligation } from "./verification";

// Official @tokenflight/api 0.4.2 protocol, used by @0gfoundation/0g-pay-sdk 0.2.1.
// https://embed.tokenflight.ai/reference/api-client
// https://embed.tokenflight.ai/concepts/transaction-lifecycle
export const TOKENFLIGHT_API = "https://api.hyperstream.dev";
export const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const SOURCE_CHAIN = 8453;
export const DESTINATION_CHAIN = 16661;
const address = z
  .string()
  .regex(/^0x[\da-fA-F]{40}$/)
  .transform((v) => v.toLowerCase());
const uint = z
  .string()
  .regex(/^\d+$/)
  .refine((v) => BigInt(v) > 0n);
const hex = z.string().regex(/^0x(?:[\da-fA-F]{2})*$/);
const hash = z
  .string()
  .regex(/^0x[\da-fA-F]{64}$/)
  .transform((v) => v.toLowerCase());
const id = z.string().min(1).max(160);
const quoteSchema = z.object({
  quoteId: id,
  routes: z.array(
    z.object({
      routeId: id,
      depositMethods: z.array(z.string()).optional(),
      quote: z.object({
        amountIn: uint,
        amountOut: uint,
        minAmountOut: uint,
        validBefore: z.number().int().positive(),
        quoteExpiresAt: z.number().int().positive().optional(),
      }),
    }),
  ),
});
const transactionSchema = z.object({
  from: address,
  to: address,
  data: hex.default("0x"),
  value: z
    .string()
    .regex(/^0x[\da-fA-F]+$/)
    .default("0x0"),
  chainId: z.union([z.string(), z.number()]).optional(),
});
const buildSchema = z.object({
  kind: z.literal("CONTRACT_CALL"),
  approvals: z
    .array(
      z.object({
        type: z.literal("eip1193_request"),
        request: z.object({
          method: z.literal("eth_sendTransaction"),
          params: z.tuple([transactionSchema]),
        }),
        deposit: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(3),
});
const onChainTx = z.object({ txHash: hash, chainId: z.number().int() });
export const orderSchema = z.object({
  id,
  quoteId: id,
  routeId: id,
  author: address,
  recipient: address,
  fromChainId: z.number().int(),
  toChainId: z.number().int(),
  fromToken: address,
  toToken: address.nullable(),
  srcAmount: uint,
  destAmount: z.string().regex(/^\d+$/),
  status: z.enum([
    "created",
    "deposited",
    "published",
    "filled",
    "refund_pending",
    "refunded",
    "failed",
  ]),
  depositTxHash: hash.nullable(),
  tradeType: z.string(),
  refundTo: address.nullable().optional(),
  transactions: z.object({ deposit: onChainTx.optional(), fill: onChainTx.optional() }).optional(),
});
export type MerchantOrder = z.infer<typeof orderSchema>;

export function merchantConfiguration() {
  const recipient = process.env.PAYMENT_RECIPIENT;
  const sourceRpc = process.env.PAYMENT_SOURCE_RPC_URL;
  const destinationRpc = process.env.PAYMENT_RPC_URL;
  const confirmations = Number(process.env.PAYMENT_CONFIRMATIONS ?? 12);
  const sourceConfirmations = Number(process.env.PAYMENT_SOURCE_CONFIRMATIONS ?? 12);
  const https = (v: string | undefined) => {
    try {
      return !!v && new URL(v).protocol === "https:";
    } catch {
      return false;
    }
  };
  const ready =
    address.safeParse(recipient).success &&
    recipient?.toLowerCase() !== zeroAddress &&
    https(sourceRpc) &&
    https(destinationRpc) &&
    Number.isSafeInteger(confirmations) &&
    confirmations >= 12 &&
    Number.isSafeInteger(sourceConfirmations) &&
    sourceConfirmations >= 12;
  invariant(
    ready,
    "PAYMENT_ROUTE_UNVERIFIED",
    "0G Pay requires a treasury and verified mainnet RPC configuration.",
    503,
  );
  return {
    recipient: recipient!.toLowerCase(),
    sourceRpc: sourceRpc!,
    destinationRpc: destinationRpc!,
    confirmations,
    sourceConfirmations,
  };
}
export async function merchantRequest(path: string, method = "GET", body?: unknown) {
  let response: Response;
  try {
    response = await fetch(TOKENFLIGHT_API + path, {
      method,
      headers: {
        "content-type": "application/json",
        "X-TF-SDK-Version": "0.4.2",
        ...(process.env.TOKENFLIGHT_INTEGRATOR_ID
          ? { "X-Integrator-Id": process.env.TOKENFLIGHT_INTEGRATOR_ID }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AppError(
      "PAYMENT_PROVIDER_UNAVAILABLE",
      "The payment provider is unavailable. Your invoice is retained.",
      503,
      true,
    );
  }
  if (!response.ok)
    throw new AppError(
      "PAYMENT_PROVIDER_UNAVAILABLE",
      "The payment provider could not complete this request. Your invoice is retained.",
      503,
      true,
    );
  return response.json() as Promise<unknown>;
}

export function validateBuild(body: unknown, wallet: string, amount: string): PaymentTransaction[] {
  const build = buildSchema.parse(body);
  const transactions = build.approvals.map((approval) => {
    const tx = approval.request.params[0];
    invariant(
      tx.from === wallet.toLowerCase(),
      "WRONG_PAYER",
      "Provider requested another wallet.",
      409,
    );
    invariant(
      tx.chainId === undefined || Number(tx.chainId) === SOURCE_CHAIN,
      "WRONG_CHAIN",
      "Provider requested another source chain.",
      409,
    );
    invariant(
      BigInt(tx.value) === 0n,
      "UNSUPPORTED_ROUTE",
      "The source transaction must spend USDC only, plus network gas.",
      409,
    );
    if (!approval.deposit) {
      invariant(
        tx.to === BASE_USDC,
        "UNSUPPORTED_ROUTE",
        "Only bounded USDC approvals are supported.",
        409,
      );
      const call = decodeFunctionData({ abi: erc20Abi, data: tx.data as `0x${string}` });
      invariant(
        call.functionName === "approve" && BigInt(call.args[1]) <= BigInt(amount),
        "UNSUPPORTED_ROUTE",
        "Unlimited or unrelated token approvals are not supported.",
        409,
      );
    }
    return {
      from: tx.from,
      to: tx.to,
      data: tx.data.toLowerCase(),
      value: tx.value.toLowerCase(),
      chainId: "0x2105",
      deposit: approval.deposit === true,
    };
  });
  const deposits = transactions.filter((tx) => tx.deposit);
  invariant(
    deposits.length === 1 && transactions.at(-1)?.deposit,
    "UNSUPPORTED_ROUTE",
    "A single final source deposit is required.",
    409,
  );
  invariant(
    deposits[0].to !== BASE_USDC && deposits[0].data.length > 10,
    "UNSUPPORTED_ROUTE",
    "A provider contract deposit is required.",
    409,
  );
  // Each token approval is restricted to the exact contract performing the deposit.
  for (const tx of transactions.filter((tx) => !tx.deposit)) {
    const call = decodeFunctionData({ abi: erc20Abi, data: tx.data as `0x${string}` });
    invariant(
      call.functionName === "approve" && call.args[0].toLowerCase() === deposits[0].to,
      "UNSUPPORTED_ROUTE",
      "Approval spender must match the deposit contract.",
      409,
    );
  }
  return transactions;
}

export async function quoteMerchant(sourceWallet: string, usdCents: number) {
  const cfg = merchantConfiguration();
  const { paymentRpc } = await import("./chain-proof");
  const [sourceChain, destinationChain, treasuryCode] = await Promise.all([
    paymentRpc(cfg.sourceRpc, "eth_chainId", []),
    paymentRpc(cfg.destinationRpc, "eth_chainId", []),
    paymentRpc(cfg.destinationRpc, "eth_getCode", [cfg.recipient, "latest"]),
  ]);
  invariant(
    Number(sourceChain) === SOURCE_CHAIN && Number(destinationChain) === DESTINATION_CHAIN,
    "WRONG_CHAIN",
    "Payment RPC must use Base and 0G mainnet.",
    503,
  );
  invariant(
    treasuryCode === "0x" || treasuryCode === "0x0",
    "UNSUPPORTED_TREASURY",
    "This merchant route requires an EOA treasury.",
    503,
  );
  invariant(
    Number.isSafeInteger(usdCents) && usdCents > 0,
    "INVALID_AMOUNT",
    "Invalid membership price.",
    422,
  );
  const wallet = address.parse(sourceWallet),
    sourceAmount = (BigInt(usdCents) * 10000n).toString();
  const quotedAt = new Date();
  const result = quoteSchema.parse(
    await merchantRequest("/v1/quotes", "POST", {
      tradeType: "EXACT_INPUT",
      fromChainId: SOURCE_CHAIN,
      fromToken: BASE_USDC,
      toChainId: DESTINATION_CHAIN,
      toToken: zeroAddress,
      amount: sourceAmount,
      fromAddress: wallet,
      recipient: cfg.recipient,
      refundTo: wallet,
      depositMethods: ["CONTRACT_CALL"],
      slippageTolerance: 0.005,
    }),
  );
  const routes = result.routes.filter(
    (route) =>
      route.quote.amountIn === sourceAmount &&
      (!route.depositMethods || route.depositMethods.includes("CONTRACT_CALL")) &&
      BigInt(route.quote.amountOut) >= BigInt(route.quote.minAmountOut) &&
      BigInt(route.quote.minAmountOut) * 1000n >= BigInt(route.quote.amountOut) * 995n &&
      Math.min(route.quote.validBefore, route.quote.quoteExpiresAt ?? route.quote.validBefore) *
        1000 >
        Date.now() + 30000,
  );
  routes.sort((a, b) => (BigInt(a.quote.minAmountOut) > BigInt(b.quote.minAmountOut) ? -1 : 1));
  const route = routes[0];
  invariant(
    route,
    "PAYMENT_ROUTE_UNVERIFIED",
    "No supported 0G Pay merchant route is available. No funds were requested.",
    503,
  );
  const expiresAt = new Date(
    Math.min(
      route.quote.validBefore * 1000,
      (route.quote.quoteExpiresAt ?? route.quote.validBefore) * 1000,
      quotedAt.getTime() + 10 * 60000,
    ),
  );
  const build = await merchantRequest("/v1/deposit/build", "POST", {
    from: wallet,
    quoteId: result.quoteId,
    routeId: route.routeId,
    recipient: cfg.recipient,
    refundTo: wallet,
    depositMethod: "CONTRACT_CALL",
  });
  const transactions = validateBuild(build, wallet, sourceAmount);
  const merchant: MerchantPayment = {
    version: 1,
    sourceChainId: SOURCE_CHAIN,
    sourceToken: BASE_USDC,
    sourceAmount,
    sourceWallet: wallet,
    destinationChainId: DESTINATION_CHAIN,
    recipient: cfg.recipient,
    minimumOutput: route.quote.minAmountOut,
    estimatedOutput: route.quote.amountOut,
    providerQuoteId: result.quoteId,
    routeId: route.routeId,
    transactions,
    quotedAt: quotedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  return {
    obligation: {
      chainId: DESTINATION_CHAIN,
      recipient: cfg.recipient,
      asset: zeroAddress,
      amount: merchant.minimumOutput,
      sourceWallet: wallet,
      providerQuoteId: result.quoteId,
      merchant,
    } satisfies Obligation,
    expiresAt,
  };
}

export function merchantFromQuote(quote: Obligation): MerchantPayment {
  const payment = quote.merchant;
  invariant(
    payment?.version === 1 &&
      payment.sourceChainId === SOURCE_CHAIN &&
      payment.destinationChainId === DESTINATION_CHAIN &&
      payment.sourceToken === BASE_USDC &&
      payment.sourceWallet === quote.sourceWallet &&
      payment.recipient === quote.recipient &&
      payment.minimumOutput === quote.amount &&
      payment.providerQuoteId === quote.providerQuoteId &&
      quote.chainId === DESTINATION_CHAIN &&
      quote.asset === zeroAddress,
    "PAYMENT_ROUTE_UNVERIFIED",
    "This invoice has no bound merchant route. Contact support before paying.",
    409,
  );
  return payment;
}

export function validateOrder(order: MerchantOrder, payment: MerchantPayment, sourceTx: string) {
  invariant(
    order.quoteId === payment.providerQuoteId &&
      order.routeId === payment.routeId &&
      order.tradeType === "EXACT_INPUT",
    "WRONG_QUOTE",
    "The provider order does not match this invoice.",
    409,
  );
  invariant(
    order.author === payment.sourceWallet &&
      (!order.refundTo || order.refundTo === payment.sourceWallet),
    "WRONG_PAYER",
    "The provider order belongs to another wallet.",
    409,
  );
  invariant(
    order.fromChainId === SOURCE_CHAIN && order.toChainId === DESTINATION_CHAIN,
    "WRONG_CHAIN",
    "The provider order uses another network.",
    409,
  );
  invariant(
    order.fromToken === BASE_USDC && (order.toToken === zeroAddress || order.toToken === null),
    "WRONG_ASSET",
    "The provider order uses another asset.",
    409,
  );
  invariant(
    order.recipient === payment.recipient,
    "WRONG_RECIPIENT",
    "The provider order uses another treasury.",
    409,
  );
  invariant(
    order.srcAmount === payment.sourceAmount &&
      (order.status !== "filled" || BigInt(order.destAmount) >= BigInt(payment.minimumOutput)),
    "UNDERPAID",
    "The provider order does not meet the quote.",
    409,
  );
  invariant(
    order.depositTxHash === sourceTx.toLowerCase() &&
      (!order.transactions?.deposit ||
        (order.transactions.deposit.txHash === sourceTx.toLowerCase() &&
          order.transactions.deposit.chainId === SOURCE_CHAIN)),
    "WRONG_SOURCE_TX",
    "The provider order has a different source transaction.",
    409,
  );
  if (order.transactions?.fill)
    invariant(
      order.transactions.fill.chainId === DESTINATION_CHAIN,
      "WRONG_CHAIN",
      "The fill is on another network.",
      409,
    );
}
