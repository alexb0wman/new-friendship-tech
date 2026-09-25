"use client";
import { OGPay, type EIP1193Provider } from "@0gfoundation/0g-pay-sdk";
/**
 * Provider UI integration point. Mount ONLY after a server-issued merchant quote
 * has a tested settlement adapter. A callback is an untrusted transaction hint.
 * This component is intentionally not mounted by the unconfigured live checkout.
 */
export function OgPayTrigger({
  provider,
  recipient,
  outputAmount,
  onTransactionHint,
  onFailure,
}: {
  provider: EIP1193Provider;
  recipient: string;
  outputAmount: string;
  onTransactionHint: (hint: unknown) => void;
  onFailure: (error: unknown) => void;
}) {
  return (
    <OGPay
      provider={provider}
      mode="developer"
      recipientAddress={recipient}
      methods={["crypto"]}
      tradeType="EXACT_INPUT"
      outputAmount={outputAmount}
      onSuccess={onTransactionHint}
      onError={onFailure}
    >
      <button className="button lime full">Open 0G Pay</button>
    </OGPay>
  );
}
