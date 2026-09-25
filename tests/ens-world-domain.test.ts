import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { keccak256, toHex } from "viem";
import { getDb, closeDb } from "@/server/db";
import * as s from "@/server/db/schema";
import { applyWrite } from "@/server/db/write";
import { AppError } from "@/server/errors";
import { api, bootSessions } from "./helpers";
import {
  ALL_ROLES,
  OWNER_BITMAP,
  REGISTRY,
  RESOLVER,
  ROLE_CAN_TRANSFER_ADMIN,
  TRIP_OWNER_BITMAP,
  admin,
  hasRole,
} from "@/server/ens-v2/roles";
import {
  dnsName,
  labelId,
  labelSchema,
  suggestLabel,
  tableLabel,
  tripName,
} from "@/server/ens-v2/names";
import { chain, resetSimulatedChain, SIM } from "@/server/ens-v2/chain";
import { assertChainWriteProof } from "@/server/ens-v2/proof";
import { enqueueEnsJob, registerEnsJobHandler, runEnsWorkerOnce } from "@/server/ens-v2/jobs";

beforeAll(async () => {
  await getDb();
  await bootSessions();
}, 30000);
afterAll(closeDb);

describe("schema and demo actors", () => {
  it("applies the trips, tables, proofs, approvals and jobs migration", async () => {
    const db = await getDb();
    const rows = (await db.execute(
      sql.raw(
        "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('trips','human_proofs','gatherings','gathering_attendees','agent_approvals','ens_jobs')",
      ),
    )) as unknown as { rows: { table_name: string }[] };
    expect(rows.rows.map((row) => row.table_name).sort()).toEqual([
      "agent_approvals",
      "ens_jobs",
      "gathering_attendees",
      "gatherings",
      "human_proofs",
      "trips",
    ]);
  });
  it("exposes Kenji and Ari as demo actors", async () => {
    expect((await api("demo/session", undefined, "POST", { actor: "kenji" })).status).toBe(200);
    expect((await api("demo/session", undefined, "POST", { actor: "ari" })).status).toBe(200);
    expect((await api("demo/session", undefined, "POST", { actor: "nobody" })).status).toBe(422);
    expect((await api("me", "kenji")).body.user.name).toBe("Kenji Mori");
  });
});

describe("ENSv2 names and roles", () => {
  it("normalises and bounds trip labels", () => {
    expect(labelSchema.parse("Maya")).toBe("maya");
    expect(labelSchema.safeParse("Ma ya").success).toBe(false);
    expect(labelSchema.safeParse("ab").success).toBe(false);
    expect(labelSchema.safeParse("-maya").success).toBe(false);
    expect(labelSchema.safeParse("maya-").success).toBe(false);
    expect(labelSchema.safeParse("a".repeat(33)).success).toBe(false);
  });
  it("suggests a label from a display name", () => {
    expect(suggestLabel("Maya Chen")).toBe("maya");
    expect(suggestLabel("Kenji Mori")).toBe("kenji");
    expect(suggestLabel("!!")).toBe("friend");
    expect(suggestLabel("")).toBe("friend");
  });
  it("builds trip and table names under the parent", () => {
    expect(tripName("tokyo", "maya")).toBe("maya.tokyo.friendship-demo.eth");
    expect(tableLabel("dinner", new Date("2026-09-27T10:00:00Z"))).toBe("dinner-0927-1900");
    expect(tableLabel("coffee", new Date("2026-09-27T15:05:00Z"), "a1b2")).toBe(
      "coffee-0928-0005-a1b2",
    );
  });
  it("encodes DNS names and label ids the way the contracts expect", () => {
    expect(dnsName("a.eth")).toBe("0x01610365746800");
    expect(labelId("alice")).toBe(BigInt(keccak256(toHex("alice"))));
  });
  it("keeps trips soulbound and anchors transferable", () => {
    expect(hasRole(TRIP_OWNER_BITMAP, ROLE_CAN_TRANSFER_ADMIN)).toBe(false);
    expect(hasRole(TRIP_OWNER_BITMAP, REGISTRY.ROLE_SET_SUBREGISTRY)).toBe(false);
    expect(hasRole(TRIP_OWNER_BITMAP, REGISTRY.ROLE_SET_RESOLVER)).toBe(true);
    expect(hasRole(OWNER_BITMAP, ROLE_CAN_TRANSFER_ADMIN)).toBe(true);
    for (const role of [...Object.values(REGISTRY), ...Object.values(RESOLVER)]) {
      expect(hasRole(ALL_ROLES, role)).toBe(true);
      expect(hasRole(ALL_ROLES, admin(role))).toBe(true);
    }
  });
});

describe("simulated chain", () => {
  const owner = "0x" + "1".padStart(40, "0");
  beforeEach(() => resetSimulatedChain());
  it("registers a trip, writes records and reads them back", async () => {
    const c = chain();
    expect(c.kind).toBe("simulated");
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const registered = await c.registerTrip({ city: "tokyo", label: "maya", owner, expiry });
    expect(registered.hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect((await c.receipt(registered.hash)).status).toBe("success");
    const name = "maya.tokyo.friendship-demo.eth";
    const written = await c.setRecords("operator", name, [
      { type: "addr", coinType: 60, address: owner },
      { type: "text", key: "friendship.trip", value: JSON.stringify({ city: "tokyo" }) },
    ]);
    expect((await c.receipt(written.hash)).to).toBe(SIM.appResolver);
    expect(await c.readAddr(name)).toBe(owner);
    expect(await c.readText(name, "friendship.trip")).toBe(JSON.stringify({ city: "tokyo" }));
    expect(await c.readText(name, "missing")).toBeNull();
    expect((await c.tripState({ city: "tokyo", label: "maya" })).status).toBe("registered");
  });
  it("lets the concierge write only friendship.now and friendship.table", async () => {
    const c = chain(),
      name = "maya.tokyo.friendship-demo.eth";
    await expect(
      c.setRecords("concierge", name, [{ type: "text", key: "friendship.now", value: "{}" }]),
    ).resolves.toHaveProperty("from", SIM.concierge);
    await expect(
      c.setRecords("concierge", name, [{ type: "text", key: "description", value: "x" }]),
    ).rejects.toHaveProperty("code", "CHAIN_REVERT");
    await expect(
      c.setRecords("concierge", name, [{ type: "addr", coinType: 60, address: owner }]),
    ).rejects.toHaveProperty("code", "CHAIN_REVERT");
    await expect(c.simulateSetText("concierge", name, "description", "x")).rejects.toHaveProperty(
      "code",
      "CHAIN_REVERT",
    );
    await expect(
      c.simulateSetText("concierge", name, "friendship.table", "x"),
    ).resolves.toBeUndefined();
    await expect(c.simulateSetText("operator", name, "description", "x")).resolves.toBeUndefined();
    expect(await c.readText(name, "description")).toBeNull();
  });
  it("refuses duplicate or past registrations and stops resolving expired trips", async () => {
    const c = chain(),
      now = Math.floor(Date.now() / 1000);
    await c.registerTrip({ city: "tokyo", label: "kenji", owner, expiry: now + 3600 });
    await expect(
      c.registerTrip({ city: "tokyo", label: "kenji", owner, expiry: now + 7200 }),
    ).rejects.toHaveProperty("code", "CHAIN_REVERT");
    await expect(
      c.registerTrip({ city: "tokyo", label: "ari", owner, expiry: now - 1 }),
    ).rejects.toHaveProperty("code", "CHAIN_REVERT");
    const name = "kenji.tokyo.friendship-demo.eth";
    await c.setRecords("operator", name, [{ type: "text", key: "friendship.trip", value: "x" }]);
    await expect(
      c.renewTrip({ city: "tokyo", label: "kenji", expiry: now + 60 }),
    ).rejects.toHaveProperty("code", "CHAIN_REVERT");
    await c.renewTrip({ city: "tokyo", label: "kenji", expiry: now + 7200 });
    expect((await c.tripState({ city: "tokyo", label: "kenji" })).expiry).toBe(now + 7200);
    await c.unregisterTrip({ city: "tokyo", label: "kenji" });
    expect(await c.readText(name, "friendship.trip")).toBeNull();
    expect((await c.tripState({ city: "tokyo", label: "kenji" })).status).toBe("available");
    await c.registerTrip({ city: "tokyo", label: "kenji", owner, expiry: now + 3600 });
    expect(await c.readText(name, "friendship.trip")).toBeNull();
  });
  it("proves a write only when the mined transaction and the re-read both match", () => {
    const submission = {
      hash: "0xabc",
      from: SIM.concierge,
      to: SIM.appResolver,
      calldata: "0x1234",
    };
    const receipt = {
      status: "success" as const,
      from: SIM.concierge,
      to: SIM.appResolver,
      input: "0x1234",
    };
    const expected = {
      records: [{ type: "text" as const, key: "friendship.table", value: "{}" }],
    };
    expect(() =>
      assertChainWriteProof({
        submission,
        receipt,
        expected,
        observed: { "text:friendship.table": "{}" },
      }),
    ).not.toThrow();
    expect(() =>
      assertChainWriteProof({
        submission,
        receipt,
        expected,
        observed: { "text:friendship.table": "{ }" },
      }),
    ).toThrow(expect.objectContaining({ code: "ENS_RECORD_MISMATCH" }));
    expect(() =>
      assertChainWriteProof({
        submission,
        receipt: { ...receipt, to: SIM.cityRegistry },
        expected,
        observed: { "text:friendship.table": "{}" },
      }),
    ).toThrow(expect.objectContaining({ code: "ENS_TX_MISMATCH" }));
    expect(() =>
      assertChainWriteProof({
        submission,
        receipt: { status: "reverted" },
        expected,
        observed: {},
      }),
    ).toThrow(expect.objectContaining({ code: "ENS_TX_FAILED" }));
    expect(() =>
      assertChainWriteProof({ submission, receipt: { status: "pending" }, expected, observed: {} }),
    ).toThrow(expect.objectContaining({ code: "PENDING" }));
    expect(() =>
      assertChainWriteProof({
        submission,
        receipt,
        expected: { records: [{ type: "text", key: "friendship.now", value: "" }] },
        observed: { "text:friendship.now": null },
      }),
    ).not.toThrow();
  });
});

describe("ENS job worker", () => {
  async function enqueue(kind: "record.set" | "table.write") {
    return applyWrite(null, "test.enqueue", "x", (tx) =>
      enqueueEnsJob(tx, { kind, signer: "concierge", entityId: "entity-" + kind }),
    );
  }
  it("marks a terminal failure for review and a success done with its hash", async () => {
    registerEnsJobHandler("record.set", async () => {
      throw new AppError("CHAIN_REVERT", "EACUnauthorizedAccountRoles", 409);
    });
    registerEnsJobHandler("table.write", async () => ({ txHash: "0xdeadbeef" }));
    const failing = await enqueue("record.set"),
      passing = await enqueue("table.write");
    expect(await runEnsWorkerOnce()).toBe(true);
    expect(await runEnsWorkerOnce()).toBe(true);
    expect(await runEnsWorkerOnce()).toBe(false);
    const db = await getDb();
    const [failed] = await db.select().from(s.ensJobs).where(eq(s.ensJobs.id, failing));
    const [done] = await db.select().from(s.ensJobs).where(eq(s.ensJobs.id, passing));
    expect(failed.status).toBe("review");
    expect(failed.lastError).toBe("CHAIN_REVERT");
    expect(failed.attempts).toBe(1);
    expect(done.status).toBe("done");
    expect(done.txHash).toBe("0xdeadbeef");
    expect(done.verifiedAt).toBeTruthy();
  });
  it("retries a retryable error with backoff instead of giving up", async () => {
    registerEnsJobHandler("record.set", async () => {
      throw new AppError("PENDING", "Still pending.", 409, true);
    });
    const id = await enqueue("record.set");
    expect(await runEnsWorkerOnce()).toBe(true);
    const db = await getDb();
    const [row] = await db.select().from(s.ensJobs).where(eq(s.ensJobs.id, id));
    expect(row.status).toBe("ready");
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBe("PENDING");
    expect(row.runAfter.getTime()).toBeGreaterThan(Date.now() + 5000);
    expect(row.leaseOwner).toBeNull();
    expect(await runEnsWorkerOnce()).toBe(false);
  });
});
