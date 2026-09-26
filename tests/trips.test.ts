import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb, closeDb, type Database } from "@/server/db";
import { DEMO_IDS, seedDemo } from "@/server/db/seed";
import * as s from "@/server/db/schema";
import { chain, resetSimulatedChain } from "@/server/ens-v2/chain";
import { expireTrips } from "@/server/ens-world/trips";
import { api, bootSessions } from "./helpers";

let db: Database;
const PARENT = "friendship-demo.eth";
const inHours = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
function activation(human: string, extra: Record<string, unknown> = {}) {
  return {
    city: "tokyo",
    arrivesAt: inHours(-1),
    departsAt: inHours(72),
    proof: { simulated: true, human },
    ...extra,
  };
}
beforeAll(async () => {
  db = await getDb();
  await bootSessions();
}, 30000);
beforeEach(async () => {
  await db.execute(sql.raw("TRUNCATE users, cities, audit_log, rate_limits CASCADE"));
  await seedDemo(db);
  resetSimulatedChain();
});
afterAll(closeDb);

describe("trips: expiring ENSv2 names gated by proof of human", () => {
  it("activates a trip, registers the name and proves the records", async () => {
    const r = await api("world/verify", "maya", "POST", activation("h-maya"));
    expect(r.status).toBe(201);
    expect(r.body.status).toBe("active");
    expect(r.body.name).toBe("maya.tokyo." + PARENT);
    expect(r.body.label).toBe("maya");
    expect(r.body.chainTx).toMatch(/^0x[0-9a-f]{64}$/);
    expect(r.body.recordsTx).toMatch(/^0x[0-9a-f]{64}$/);
    expect(r.body.chainVerifiedAt).toBeTruthy();
    expect(r.body.verifiedHuman).toBe(true);
    expect(r.body.explorer.name).toBeNull();
    const me = await api("trips/me", "maya");
    expect(me.body.trip.id).toBe(r.body.id);
    expect(await chain().readAddr(r.body.name)).toBe("0x" + "2".padStart(40, "0"));
    const trip = JSON.parse((await chain().readText(r.body.name, "friendship.trip")) ?? "{}");
    expect(trip.city).toBe("tokyo");
    expect(trip.verifiedHuman).toBe(true);
    expect(await chain().readText(r.body.name, "description")).toBe(
      "Travelling with New Friendship Tech",
    );
    const [user] = await db.select().from(s.users).where(eq(s.users.id, DEMO_IDS.maya));
    expect(user.verifiedHumanAt).toBeTruthy();
    const jobs = await db.select().from(s.ensJobs);
    expect(jobs.map((job) => job.status)).toEqual(["done"]);
  });
  it("answers a public name lookup with presence only, never account data", async () => {
    const r = await api("world/verify", "maya", "POST", activation("h-maya"));
    const lookup = await api("trips/" + r.body.name);
    expect(lookup.status).toBe(200);
    // The demo seed gives Maya an open coffee invitation, so her presence shows as a now record.
    expect(lookup.body).toEqual({
      name: r.body.name,
      city: "tokyo",
      active: true,
      departsAt: r.body.departsAt,
      verifiedHuman: true,
      now: { kind: "Coffee", area: "Shibuya", until: expect.any(String) },
    });
    expect(Object.keys(lookup.body).sort()).toEqual([
      "active",
      "city",
      "departsAt",
      "name",
      "now",
      "verifiedHuman",
    ]);
    expect(JSON.stringify(lookup.body)).not.toContain(DEMO_IDS.maya);
    expect(JSON.stringify(lookup.body)).not.toContain("0x");
    expect((await api("trips/nobody.tokyo." + PARENT)).status).toBe(404);
    expect((await api("trips/me")).status).toBe(401);
  });
  it("requires All Access before a name is minted", async () => {
    const r = await api("world/verify", "alex", "POST", activation("h-alex"));
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("MEMBERSHIP_REQUIRED");
    expect(await db.select().from(s.trips)).toHaveLength(0);
  });
  it("lets one human hold one active trip per city, across accounts", async () => {
    expect((await api("world/verify", "maya", "POST", activation("same-human"))).status).toBe(201);
    const r = await api("world/verify", "kenji", "POST", activation("same-human"));
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("HUMAN_ALREADY_PRESENT");
    expect(await db.select().from(s.trips)).toHaveLength(1);
    expect(await db.select().from(s.humanProofs)).toHaveLength(1);
  });
  it("shows the alternative paths: cancelled, unavailable credential, bad proof", async () => {
    const unavailable = await api(
      "world/verify",
      "maya",
      "POST",
      activation("h-maya", { proof: { simulated: true, human: "h-maya", unavailable: true } }),
    );
    expect(unavailable.status).toBe(422);
    expect(unavailable.body.error.code).toBe("WORLD_CREDENTIAL_UNAVAILABLE");
    const garbage = await api(
      "world/verify",
      "maya",
      "POST",
      activation("h-maya", { proof: { garbage: true } }),
    );
    expect(garbage.status).toBe(422);
    expect(garbage.body.error.code).toBe("WORLD_VERIFY_FAILED");
    expect(await db.select().from(s.trips)).toHaveLength(0);
    expect(await db.select().from(s.humanProofs)).toHaveLength(0);
  });
  it("rejects a second trip in the same city and bad dates", async () => {
    await api("world/verify", "maya", "POST", activation("h-maya"));
    const again = await api("world/verify", "maya", "POST", activation("h-maya-2"));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("TRIP_EXISTS");
    const past = await api(
      "world/verify",
      "kenji",
      "POST",
      activation("h-kenji", { departsAt: inHours(-2) }),
    );
    expect(past.status).toBe(422);
    expect(past.body.error.code).toBe("TRIP_DATES");
    const tooLong = await api(
      "world/verify",
      "kenji",
      "POST",
      activation("h-kenji", { departsAt: inHours(24 * 120) }),
    );
    expect(tooLong.body.error.code).toBe("TRIP_DATES");
  });
  it("resolves label collisions with a numeric suffix", async () => {
    await api("world/verify", "maya", "POST", activation("h-maya"));
    const r = await api("world/verify", "ari", "POST", activation("h-ari", { label: "maya" }));
    expect(r.status).toBe(201);
    expect(r.body.label).toBe("maya-2");
    expect(r.body.name).toBe("maya-2.tokyo." + PARENT);
    const bad = await api("world/verify", "kenji", "POST", activation("h-kenji", { label: "a b" }));
    expect(bad.status).toBe(422);
  });
  it("extends only forward and ends on request", async () => {
    const created = await api("world/verify", "maya", "POST", activation("h-maya"));
    const shorter = await api("trips/extend", "maya", "POST", { departsAt: inHours(24) });
    expect(shorter.status).toBe(422);
    const longer = await api("trips/extend", "maya", "POST", { departsAt: inHours(96) });
    expect(longer.status).toBe(200);
    expect(new Date(longer.body.departsAt).getTime()).toBeGreaterThan(
      new Date(created.body.departsAt).getTime(),
    );
    const state = await chain().tripState({ city: "tokyo", label: "maya" });
    expect(state.expiry).toBe(Math.floor(new Date(longer.body.departsAt).getTime() / 1000));
    const ended = await api("trips/end", "maya", "POST", {});
    expect(ended.status).toBe(200);
    expect(ended.body.status).toBe("ended");
    expect((await api("trips/me", "maya")).body.trip).toBeNull();
    expect(await chain().readText(created.body.name, "friendship.trip")).toBeNull();
    expect((await api("trips/end", "maya", "POST", {})).status).toBe(404);
  });
  it("expires on departure, stops resolving and frees the human for a new trip", async () => {
    const created = await api("world/verify", "maya", "POST", activation("h-maya"));
    const departsAt = new Date(created.body.departsAt);
    expect(await expireTrips(new Date(departsAt.getTime() - 1000))).toBe(0);
    expect(await expireTrips(new Date(departsAt.getTime() + 1000))).toBe(1);
    const { drainEnsJobs } = await import("@/server/ens-v2/jobs");
    await drainEnsJobs();
    const [row] = await db.select().from(s.trips).where(eq(s.trips.id, created.body.id));
    expect(row.status).toBe("expired");
    expect(await chain().readText(created.body.name, "friendship.trip")).toBeNull();
    expect((await api("trips/" + created.body.name)).body.active).toBe(false);
    expect((await api("trips/me", "maya")).body.trip).toBeNull();
    const again = await api("world/verify", "kenji", "POST", activation("h-maya"));
    expect(again.status).toBe(201);
  });
  it("writes and clears a pay record on the 0G coin type through the operator", async () => {
    const created = await api("world/verify", "maya", "POST", activation("h-maya"));
    const on = await api("trips/pay-record", "maya", "POST", { enabled: true });
    expect(on.status).toBe(200);
    expect(on.body.payAddress).toBe("0x" + "2".padStart(40, "0"));
    expect(await chain().readAddr(created.body.name, 0x80000000 + 16661)).toBe(on.body.payAddress);
    const off = await api("trips/pay-record", "maya", "POST", { enabled: false });
    expect(off.body.payAddress).toBeNull();
    expect(await chain().readAddr(created.body.name, 0x80000000 + 16661)).toBeNull();
  });
});
