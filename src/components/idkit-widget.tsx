"use client";
import {
  IDKitRequestWidget,
  passport,
  proofOfHuman,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";

/**
 * The real World ID widget, loaded only in production builds through next/dynamic so the local
 * demo never ships it. The backend signs rp_context and verifies the returned proof; the widget
 * itself never sees a secret.
 */
export default function IdkitWidget({
  open,
  onOpenChange,
  appId,
  action,
  rpContext,
  environment,
  credential,
  signal,
  onVerify,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  action: string;
  rpContext: RpContext;
  environment: "production" | "staging" | "sandbox";
  credential: "human" | "passport";
  signal: string;
  onVerify: (result: IDKitResult) => Promise<void>;
  onError?: (code: string) => void;
}) {
  const preset = credential === "passport" ? passport({ signal }) : proofOfHuman({ signal });
  return (
    <IDKitRequestWidget
      open={open}
      onOpenChange={onOpenChange}
      app_id={appId as `app_${string}`}
      action={action}
      rp_context={rpContext}
      allow_legacy_proofs={true}
      preset={preset}
      environment={environment}
      handleVerify={onVerify}
      onSuccess={() => undefined}
      onError={(code) => onError?.(String(code))}
    />
  );
}
