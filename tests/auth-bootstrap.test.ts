import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicAuthConfig } from "@/server/config";
import { handleApi } from "@/server/router";
import { getDb } from "@/server/db";

vi.mock("@/server/db", () => ({
  getDb: vi.fn(() => {
    throw new Error("Authentication bootstrap must not require the database.");
  }),
}));

beforeEach(() => {
  vi.stubEnv("APP_MODE", "production");
  vi.stubEnv("ENS_SIMULATED", "false");
  vi.stubEnv("NFT_EMBEDDED_DB", "false");
  vi.stubEnv("PRIVY_APP_ID", "runtime-app");
  vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "old-build-app");
  vi.stubEnv("PRIVY_APP_SECRET", "server-secret-never-public");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("runtime sign-in bootstrap", () => {
  it("uses the verifier's runtime app ID instead of the old browser build value", async () => {
    const response = await handleApi(new Request("http://localhost:3000/api/auth/config"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ demo: false, enabled: true, appId: "runtime-app" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("works when no public app ID was supplied at build time", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", undefined);
    expect(publicAuthConfig()).toEqual({ demo: false, enabled: true, appId: "runtime-app" });
  });

  it("retains the legacy public-ID fallback without exposing any server credentials", async () => {
    vi.stubEnv("PRIVY_APP_ID", undefined);
    vi.stubEnv("DATABASE_URL", "postgres://private-database-secret");
    const response = await handleApi(new Request("http://localhost:3000/api/auth/config"));
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ demo: false, enabled: true, appId: "old-build-app" });
    expect(body).not.toContain("server-secret-never-public");
    expect(body).not.toContain("private-database-secret");
  });

  it("keeps sign-in unavailable until the server can verify the resulting token", () => {
    vi.stubEnv("PRIVY_APP_SECRET", undefined);
    expect(publicAuthConfig()).toEqual({ demo: false, enabled: false, appId: "runtime-app" });
    vi.stubEnv("PRIVY_APP_ID", undefined);
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", undefined);
    expect(publicAuthConfig()).toEqual({ demo: false, enabled: false, appId: null });
  });

  it("gets local demo mode from runtime rather than a stale browser bundle", () => {
    vi.stubEnv("APP_MODE", "demo");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "production");
    expect(publicAuthConfig()).toEqual({ demo: true, enabled: true, appId: null });
  });

  it("never serves a simulated sign-in from a production process", () => {
    vi.stubEnv("APP_MODE", "demo");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => publicAuthConfig()).toThrow("Demo mode is forbidden");
  });
});
