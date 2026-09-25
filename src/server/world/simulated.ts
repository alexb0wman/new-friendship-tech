import { randomBytes } from "node:crypto";
import { keccak256, toHex } from "viem";
import { AppError, invariant } from "@/server/errors";
import { isDemo } from "@/server/config";
import type { AgentIdentity, RpContextDTO, VerifiedProof, WorldAdapter } from "./adapter";
import { simulatedProofSchema } from "./adapter";

/**
 * Demo-only World: a proof is `{ simulated: true, human: "<any label>" }` and the nullifier is a
 * hash of that label, so the same "human" activating twice trips HUMAN_ALREADY_PRESENT exactly like
 * a real duplicate nullifier would. Agent approvals surface as a `simulated://` URL that the UI
 * renders as an approve/deny panel posting to the demo-only simulate route.
 */
class SimulatedWorld implements WorldAdapter {
  readonly kind = "simulated" as const;
  async rpContext(action: string): Promise<RpContextDTO> {
    invariant(isDemo(), "NOT_FOUND", "Not found.", 404);
    const now = Math.floor(Date.now() / 1000);
    return {
      rp_id: "rp_simulated",
      app_id: "app_simulated",
      action,
      nonce: "0x" + randomBytes(32).toString("hex"),
      created_at: now,
      expires_at: now + 300,
      signature: "0xsimulated",
      environment: "simulated",
    };
  }
  async verifyProof(input: {
    payload: unknown;
    action: string;
    signal: string;
  }): Promise<VerifiedProof> {
    invariant(isDemo(), "NOT_FOUND", "Not found.", 404);
    const parsed = simulatedProofSchema.safeParse(input.payload);
    if (!parsed.success)
      throw new AppError("WORLD_VERIFY_FAILED", "World ID could not verify this proof.", 422);
    if (parsed.data.unavailable)
      throw new AppError(
        "WORLD_CREDENTIAL_UNAVAILABLE",
        "This World ID has no Proof of Human credential yet. Try the passport path.",
        422,
      );
    return {
      nullifier: BigInt(keccak256(toHex("sim:" + parsed.data.human))).toString(),
      signalHash: keccak256(toHex(input.signal)),
      issuerSchemaId: "simulated",
      expiresAtMin: null,
      environment: "simulated",
    };
  }
  async agentAuthorizeUrl(input: { approvalId: string }) {
    return "simulated://approval/" + input.approvalId;
  }
  async agentExchange(): Promise<AgentIdentity> {
    throw new AppError("WORLD_AGENT_TOKEN", "The simulated World has no token endpoint.", 401);
  }
}
let instance: SimulatedWorld | undefined;
export function simulatedWorld(): WorldAdapter {
  return (instance ??= new SimulatedWorld());
}
/** What the demo-only simulate route hands to finishApproval in place of a real ID token. */
export function simulatedIdentity(human: string, nonce: string): AgentIdentity {
  return { issuer: "simulated", sub: "sim:" + human, nonce, authTime: new Date() };
}
