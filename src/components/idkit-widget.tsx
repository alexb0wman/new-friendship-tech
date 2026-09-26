"use client";
import {
  IDKitRequestWidget,
  CredentialRequest,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";

/**
 * The real World ID widget, loaded only for live flows through next/dynamic. The backend signs
 * rp_context and verifies the returned proof; the widget
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
  requireUserPresence = false,
  description,
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
  requireUserPresence?: boolean;
  description?: string;
}) {
  const constraints = CredentialRequest(credential === "passport" ? "passport" : "proof_of_human", {
    signal,
    expires_at_min: rpContext.expires_at,
  });
  return (
    <IDKitRequestWidget
      open={open}
      onOpenChange={onOpenChange}
      app_id={appId as `app_${string}`}
      action={action}
      rp_context={rpContext}
      allow_legacy_proofs={false}
      require_user_presence={requireUserPresence}
      action_description={description}
      constraints={constraints}
      environment={environment}
      handleVerify={onVerify}
      onSuccess={() => undefined}
      onError={(code) => onError?.(String(code))}
    />
  );
}
