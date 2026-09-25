import { createRemoteJWKSet, jwtVerify } from "jose";
import { AppError, invariant } from "@/server/errors";
import {
  nullifierToDecimal,
  type AgentIdentity,
  type RpContextDTO,
  type VerifiedProof,
  type WorldAdapter,
} from "./adapter";

interface WorldEnv {
  appId: string;
  rpId: string;
  signingKey: string;
  environment: "production" | "staging" | "sandbox";
  verifyBase: string;
  agents: {
    issuer: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  } | null;
}
function env(): WorldEnv {
  const appId = process.env.WORLD_APP_ID,
    rpId = process.env.WORLD_RP_ID,
    signingKey = process.env.WORLD_RP_SIGNING_KEY;
  invariant(
    appId && rpId && signingKey,
    "WORLD_UNAVAILABLE",
    "World ID is not configured: set WORLD_APP_ID, WORLD_RP_ID and WORLD_RP_SIGNING_KEY.",
    503,
  );
  const environment = (process.env.WORLD_ENVIRONMENT ?? "staging") as WorldEnv["environment"];
  invariant(
    ["production", "staging", "sandbox"].includes(environment),
    "WORLD_UNAVAILABLE",
    "WORLD_ENVIRONMENT must be production, staging or sandbox.",
    503,
  );
  const issuer = process.env.WORLD_AGENTS_ISSUER,
    clientId = process.env.WORLD_AGENTS_CLIENT_ID,
    clientSecret = process.env.WORLD_AGENTS_CLIENT_SECRET,
    redirectUri = process.env.WORLD_AGENTS_REDIRECT_URI;
  return {
    appId,
    rpId,
    signingKey: signingKey.replace(/^0x/, ""),
    environment,
    verifyBase: process.env.WORLD_VERIFY_BASE ?? "https://developer.world.org",
    agents:
      issuer && clientId && clientSecret && redirectUri
        ? { issuer: issuer.replace(/\/$/, ""), clientId, clientSecret, redirectUri }
        : null,
  };
}
interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}
/**
 * Live World: IDKit v4 request signing and proof verification through the Developer Portal, and the
 * World ID for Agents OIDC provider (authorization code + PKCE S256, pairwise sub, RS256 ID tokens,
 * `prompt=login` plus `max_age=0` for a fresh step-up). Secrets never leave the server.
 */
class LiveWorld implements WorldAdapter {
  readonly kind = "live" as const;
  private discovery?: Promise<Discovery>;
  private jwks?: ReturnType<typeof createRemoteJWKSet>;
  async rpContext(action: string): Promise<RpContextDTO> {
    const e = env();
    const { signRequest } = await import("@worldcoin/idkit-core/signing");
    const signed = signRequest({ signingKeyHex: e.signingKey, action });
    return {
      rp_id: e.rpId,
      app_id: e.appId,
      action,
      nonce: signed.nonce,
      created_at: signed.createdAt,
      expires_at: signed.expiresAt,
      signature: signed.sig,
      environment: e.environment,
    };
  }
  async verifyProof(input: {
    payload: unknown;
    action: string;
    signal: string;
  }): Promise<VerifiedProof> {
    const e = env();
    const payload = input.payload as {
      action?: string;
      responses?: {
        nullifier?: string;
        signal_hash?: string;
        issuer_schema_id?: number | string;
        expires_at_min?: number;
      }[];
    } | null;
    invariant(
      payload && typeof payload === "object" && Array.isArray(payload.responses),
      "WORLD_VERIFY_FAILED",
      "World ID could not verify this proof.",
      422,
    );
    invariant(
      !payload.action || payload.action === input.action,
      "WORLD_VERIFY_FAILED",
      "The proof was made for a different action.",
      422,
    );
    let response: Response;
    try {
      response = await fetch(`${e.verifyBase}/api/v4/verify/${encodeURIComponent(e.rpId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new AppError("WORLD_VERIFY_FAILED", "World ID verification is unreachable.", 503, true);
    }
    const body = (await response.json().catch(() => null)) as {
      success?: boolean;
      environment?: string;
      nullifier?: string;
      results?: { nullifier?: string; success?: boolean; code?: string }[];
      code?: string;
      detail?: string;
    } | null;
    if (!response.ok || !body?.success) {
      const code = body?.code ?? body?.results?.[0]?.code ?? "";
      if (/credential|unavailable|not_found|no_credential/i.test(code))
        throw new AppError(
          "WORLD_CREDENTIAL_UNAVAILABLE",
          "This World ID has no matching credential yet. Try the other path.",
          422,
        );
      throw new AppError("WORLD_VERIFY_FAILED", "World ID could not verify this proof.", 422);
    }
    invariant(
      body.environment === e.environment,
      "WORLD_VERIFY_FAILED",
      "The proof came from a different World environment.",
      422,
    );
    const first = payload.responses[0] ?? {};
    const nullifier = nullifierToDecimal(
      body.nullifier ?? body.results?.[0]?.nullifier ?? first.nullifier,
    );
    const signalHash = typeof first.signal_hash === "string" ? first.signal_hash : null;
    if (signalHash && signalHash !== "0x0" && !/^0x0+$/.test(signalHash)) {
      const { hashSignal } = await import("@worldcoin/idkit-core/hashing");
      invariant(
        hashSignal(input.signal).toLowerCase() === signalHash.toLowerCase(),
        "WORLD_SIGNAL_MISMATCH",
        "The proof was bound to a different city.",
        422,
      );
    }
    return {
      nullifier,
      signalHash,
      issuerSchemaId: first.issuer_schema_id == null ? null : String(first.issuer_schema_id),
      expiresAtMin:
        typeof first.expires_at_min === "number" ? new Date(first.expires_at_min * 1000) : null,
      environment: body.environment,
    };
  }
  private agents() {
    const e = env();
    invariant(
      e.agents,
      "WORLD_AGENTS_UNAVAILABLE",
      "World ID for Agents is not configured: set the issuer, client id, client secret and redirect URI.",
      503,
    );
    return e.agents;
  }
  private async discover(): Promise<Discovery> {
    const a = this.agents();
    return (this.discovery ??= (async () => {
      const response = await fetch(a.issuer + "/.well-known/openid-configuration", {
        signal: AbortSignal.timeout(10000),
      });
      invariant(response.ok, "WORLD_AGENTS_UNAVAILABLE", "OIDC discovery failed.", 503);
      const doc = (await response.json()) as Discovery;
      invariant(
        doc.issuer === a.issuer && doc.authorization_endpoint && doc.token_endpoint && doc.jwks_uri,
        "WORLD_AGENTS_UNAVAILABLE",
        "OIDC discovery document is incomplete.",
        503,
      );
      return doc;
    })());
  }
  async agentAuthorizeUrl(input: {
    approvalId: string;
    nonce: string;
    codeChallenge: string;
    fresh: boolean;
  }) {
    const a = this.agents(),
      doc = await this.discover();
    const url = new URL(doc.authorization_endpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", a.clientId);
    url.searchParams.set("redirect_uri", a.redirectUri);
    url.searchParams.set("scope", "openid");
    url.searchParams.set("state", input.approvalId);
    url.searchParams.set("nonce", input.nonce);
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    if (input.fresh) {
      url.searchParams.set("prompt", "login");
      url.searchParams.set("max_age", "0");
    }
    return url.toString();
  }
  async agentExchange(input: { code: string; codeVerifier: string }): Promise<AgentIdentity> {
    const a = this.agents(),
      doc = await this.discover();
    const response = await fetch(doc.token_endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: "Basic " + Buffer.from(a.clientId + ":" + a.clientSecret).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: a.redirectUri,
        code_verifier: input.codeVerifier,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await response.json().catch(() => null)) as { id_token?: string } | null;
    invariant(
      response.ok && body?.id_token,
      "WORLD_AGENT_TOKEN",
      "World ID did not issue an identity for this approval.",
      401,
    );
    this.jwks ??= createRemoteJWKSet(new URL(doc.jwks_uri));
    let payload;
    try {
      payload = (
        await jwtVerify(body.id_token, this.jwks, {
          issuer: doc.issuer,
          audience: a.clientId,
          algorithms: ["RS256"],
        })
      ).payload;
    } catch {
      throw new AppError("WORLD_AGENT_TOKEN", "The identity token failed validation.", 401);
    }
    invariant(
      typeof payload.sub === "string" && typeof payload.nonce === "string",
      "WORLD_AGENT_TOKEN",
      "The identity token is missing its subject or nonce.",
      401,
    );
    const authTime = typeof payload.auth_time === "number" ? payload.auth_time : payload.iat;
    return {
      issuer: doc.issuer,
      sub: payload.sub,
      nonce: payload.nonce,
      authTime: new Date((authTime ?? 0) * 1000),
      acr: typeof payload.acr === "string" ? payload.acr : undefined,
    };
  }
}
let instance: LiveWorld | undefined;
export function liveWorld(): WorldAdapter {
  return (instance ??= new LiveWorld());
}
