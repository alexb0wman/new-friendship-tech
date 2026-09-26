import { afterEach, describe, expect, it, vi } from "vitest";
import { assertRuntimeSafety, previewEns, productionRequirements } from "../src/server/config";
import { integrationReadiness } from "../src/server/integration-readiness";

afterEach(() => vi.unstubAllEnvs());

describe("production adapter boundaries", () => {
  it("refuses the old public-alpha simulation switch in a real account process", () => {
    vi.stubEnv("APP_MODE", "production");
    vi.stubEnv("ENS_SIMULATED", "true");
    expect(() => previewEns()).toThrow("local-demo only");
    expect(productionRequirements()).toContain("ENS_SIMULATED=false");
  });
  it("refuses ephemeral storage outside local demo", () => {
    vi.stubEnv("APP_MODE", "production");
    vi.stubEnv("NFT_EMBEDDED_DB", "true");
    expect(() => assertRuntimeSafety()).toThrow("durable PostgreSQL");
  });
  it("preserves the explicitly local demonstration", () => {
    vi.stubEnv("APP_MODE", "demo");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENS_SIMULATED", "true");
    expect(previewEns()).toBe(true);
  });
  it("cannot pass a demo through a production process", () => {
    vi.stubEnv("APP_MODE", "demo");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertRuntimeSafety()).toThrow("Demo mode is forbidden");
  });
});

describe("launch readiness", () => {
  it("never claims ENSv2 mainnet or live execution from configuration alone", () => {
    const report = integrationReadiness();
    expect(report.ensv2MainnetAvailable).toBe(false);
    expect(report.liveExecutionVerified).toBe(false);
    expect(report.checks.find((check) => check.name === "ensv2")?.network).toContain("Sepolia");
  });
  it("does not leak RPC credentials or signing keys", () => {
    vi.stubEnv("WORLD_RP_SIGNING_KEY", "secret-signing-key");
    vi.stubEnv("PAYMENT_RPC_URL", "https://node.example/rpc/private-api-token");
    const report = JSON.stringify(integrationReadiness());
    expect(report).not.toContain("secret-signing-key");
    expect(report).not.toContain("private-api-token");
  });
  it("does not accept World staging as ready for production", () => {
    vi.stubEnv("WORLD_ENVIRONMENT", "staging");
    expect(
      integrationReadiness().checks.find((check) => check.name === "world")?.missing,
    ).toContain("WORLD_ENVIRONMENT=production");
  });
  it("accepts the same World signing-key format as IDKit and rejects malformed RP ids", () => {
    vi.stubEnv("WORLD_RP_SIGNING_KEY", "a".repeat(64));
    vi.stubEnv("WORLD_RP_ID", "invalid");
    const missing = integrationReadiness().checks.find((check) => check.name === "world")!.missing;
    expect(missing).not.toContain("WORLD_RP_SIGNING_KEY");
    expect(missing).toContain("WORLD_RP_ID");
  });
  it("rejects an ENS key outside the signing curve", () => {
    vi.stubEnv("ENS_OPERATOR_PRIVATE_KEY", "0x" + "0".repeat(64));
    expect(
      integrationReadiness().checks.find((check) => check.name === "ensv2")!.missing,
    ).toContain("ENS_OPERATOR_PRIVATE_KEY");
  });
});
