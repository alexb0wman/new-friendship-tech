import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { keccak256, toHex } from "viem";
import { getDb, closeDb } from "@/server/db";
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
