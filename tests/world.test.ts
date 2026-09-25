import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getDb, closeDb, type Database } from "@/server/db";
import { seedDemo } from "@/server/db/seed";
import { bootSessions } from "./helpers";
import { nullifierToDecimal, world } from "@/server/world/adapter";

let db: Database;
beforeAll(async () => {
  db = await getDb();
  await bootSessions();
}, 30000);
beforeEach(async () => {
  await db.execute(sql.raw("TRUNCATE users, cities, audit_log, rate_limits CASCADE"));
  await seedDemo(db);
});
afterAll(closeDb);

describe("World adapter (simulated under demo)", () => {
  it("selects the simulated World in demo mode", () => {
    expect(world().kind).toBe("simulated");
  });
  it("converts nullifier hex to a decimal string and rejects junk", () => {
    expect(nullifierToDecimal("0x0a")).toBe("10");
    expect(nullifierToDecimal("0x" + "f".repeat(64))).toBe((2n ** 256n - 1n).toString());
    expect(() => nullifierToDecimal("10")).toThrow();
    expect(() => nullifierToDecimal(undefined)).toThrow();
  });
  it("derives a stable nullifier per simulated human and binds the signal", async () => {
    const a = await world().verifyProof({
      payload: { simulated: true, human: "maya" },
      action: "trip-activate",
      signal: "tokyo",
    });
    const again = await world().verifyProof({
      payload: { simulated: true, human: "maya" },
      action: "trip-activate",
      signal: "tokyo",
    });
    const other = await world().verifyProof({
      payload: { simulated: true, human: "kenji" },
      action: "trip-activate",
      signal: "tokyo",
    });
    expect(a.nullifier).toBe(again.nullifier);
    expect(a.nullifier).not.toBe(other.nullifier);
    expect(/^[0-9]+$/.test(a.nullifier)).toBe(true);
    expect(a.signalHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a.environment).toBe("simulated");
  });
  it("reports the alternative paths as distinct codes", async () => {
    await expect(
      world().verifyProof({
        payload: { simulated: true, human: "x", unavailable: true },
        action: "trip-activate",
        signal: "tokyo",
      }),
    ).rejects.toHaveProperty("code", "WORLD_CREDENTIAL_UNAVAILABLE");
    await expect(
      world().verifyProof({ payload: { garbage: true }, action: "trip-activate", signal: "tokyo" }),
    ).rejects.toHaveProperty("code", "WORLD_VERIFY_FAILED");
    await expect(
      world().verifyProof({ payload: "0xproof", action: "trip-activate", signal: "tokyo" }),
    ).rejects.toHaveProperty("code", "WORLD_VERIFY_FAILED");
  });
  it("loads the IDKit signal hashing helper the live adapter relies on", async () => {
    const { hashSignal } = await import("@worldcoin/idkit-core/hashing");
    expect(hashSignal("tokyo")).toMatch(/^0x[0-9a-f]+$/);
    expect(hashSignal("tokyo")).toBe(hashSignal("tokyo"));
    expect(hashSignal("tokyo")).not.toBe(hashSignal("seoul"));
  });
});
