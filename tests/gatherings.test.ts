import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb, closeDb, type Database } from "@/server/db";
import { DEMO_IDS, seedDemo } from "@/server/db/seed";
import * as s from "@/server/db/schema";
import { chain, resetSimulatedChain } from "@/server/ens-v2/chain";
import { computeShares } from "@/server/ens-world/split";
import { api, bootSessions } from "./helpers";

let db: Database;
const PARENT = "friendship-demo.eth";
const inHours = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
async function activate(actor: string, human: string) {
  const r = await api("world/verify", actor, "POST", {
    city: "tokyo",
    arrivesAt: inHours(-1),
    departsAt: inHours(72),
    proof: { simulated: true, human },
  });
  expect(r.status).toBe(201);
  return r.body;
}
async function link(actor: string) {
  const created = await api("world/agent/link", actor, "POST", {});
  const done = await api("world/agent/simulate", actor, "POST", {
    approvalId: created.body.id,
    decision: "approve",
  });
  expect(done.body.status).toBe("consumed");
}
async function approve(actor: string, approvalId: string, decision = "approve") {
  return api("world/agent/simulate", actor, "POST", { approvalId, decision });
}
async function record(name: string) {
  return JSON.parse((await chain().readText(name, "friendship.table")) ?? "null");
}
async function host(actor = "kenji", seats = 4) {
  const r = await api("gatherings", actor, "POST", {
    city: "tokyo",
    kind: "dinner",
    area: "Shibuya",
    startsAt: inHours(5),
    seats,
  });
  expect(r.status).toBe(201);
  return r.body;
}
beforeAll(async () => {
  db = await getDb();
  await bootSessions();
}, 30000);
beforeEach(async () => {
  await db.execute(sql.raw("TRUNCATE users, cities, audit_log, rate_limits CASCADE"));
  await seedDemo(db);
  resetSimulatedChain();
  await activate("maya", "h-maya");
  await activate("kenji", "h-kenji");
  await activate("ari", "h-ari");
  await link("maya");
  await link("kenji");
  await link("ari");
});
afterAll(closeDb);

describe("tables: data-only ENSv2 names with concierge-written attendee records", () => {
  it("hosts a table, writes the record from the concierge wallet and proves it", async () => {
    const table = await host();
    expect(table.name).toMatch(
      new RegExp("^dinner-\\d{4}-\\d{4}\\.tables\\.tokyo\\." + PARENT.replace(".", "\\.") + "$"),
    );
    expect(table.status).toBe("open");
    expect(table.seatsLeft).toBe(3);
    expect(table.host.name).toBe("kenji.tokyo." + PARENT);
    expect(table.host.verifiedHuman).toBe(true);
    expect(table.chainRecordTx).toMatch(/^0x[0-9a-f]{64}$/);
    expect(table.chainVerifiedAt).toBeTruthy();
    const written = await record(table.name);
    expect(written).toMatchObject({
      v: 1,
      kind: "dinner",
      area: "Shibuya",
      seats: 4,
      host: "kenji.tokyo." + PARENT,
      attendees: ["kenji.tokyo." + PARENT],
      guests: 0,
      status: "open",
    });
    expect(written.expiresAt - written.startsAt).toBe(6 * 3600);
    expect(JSON.stringify(written)).not.toContain(DEMO_IDS.kenji);
    expect((await chain().receipt(table.chainRecordTx)).from).toBe(chain().addresses.concierge);
    const listed = await api("gatherings?city=tokyo", "maya");
    expect(listed.body.items.map((item: { id: string }) => item.id)).toEqual([table.id]);
    expect(listed.body.items[0].mine).toBe(false);
    expect(table.record).toBe(await chain().readText(table.name, "friendship.table"));
  });
  it("refuses hosts without a trip and members without All Access", async () => {
    const noTrip = await api("gatherings", "admin", "POST", {
      city: "tokyo",
      kind: "coffee",
      area: "Ginza",
      startsAt: inHours(2),
      seats: 2,
    });
    expect(noTrip.status).toBe(403);
    expect(noTrip.body.error.code).toBe("TRIP_REQUIRED");
    expect((await api("gatherings?city=tokyo", "alex")).status).toBe(403);
    const table = await host();
    expect(
      (await api("gatherings/" + table.id + "/request", "alex", "POST", { plusOnes: 0 })).status,
    ).toBe(403);
  });
  it("gates a seat request and the host approval behind two separate step-ups", async () => {
    const table = await host();
    const request = await api("gatherings/" + table.id + "/request", "maya", "POST", {
      plusOnes: 1,
    });
    expect(request.status).toBe(201);
    expect(request.body.action).toBe("table.request");
    expect(request.body.status).toBe("pending");
    expect(await db.select().from(s.gatheringAttendees)).toHaveLength(1);
    const requested = await approve("maya", request.body.id);
    expect(requested.body.status).toBe("consumed");
    const detail = await api("gatherings/" + table.id, "kenji");
    const maya = detail.body.attendees.find(
      (a: { name: string }) => a.name === "maya.tokyo." + PARENT,
    );
    expect(maya.status).toBe("requested");
    expect(maya.plusOnes).toBe(1);
    expect((await record(table.name)).attendees).toHaveLength(1);
    expect((await approve("maya", request.body.id)).body.error.code).toBe("APPROVAL_CONSUMED");
    const decision = await api("gatherings/" + table.id + "/approve", "kenji", "POST", {
      attendeeId: maya.id,
    });
    expect(decision.status).toBe(201);
    expect(decision.body.action).toBe("table.approve");
    expect((await record(table.name)).attendees).toHaveLength(1);
    expect((await approve("kenji", decision.body.id)).body.status).toBe("consumed");
    const after = await record(table.name);
    expect(after.attendees.sort()).toEqual(
      ["kenji.tokyo." + PARENT, "maya.tokyo." + PARENT].sort(),
    );
    expect(after.guests).toBe(1);
    const summary = (await api("gatherings?city=tokyo", "maya")).body.items[0];
    expect(summary.seatsLeft).toBe(1);
    expect(summary.myStatus).toBe("approved");
    expect(
      (await api("gatherings/" + table.id + "/approve", "maya", "POST", { attendeeId: maya.id }))
        .status,
    ).toBe(403);
  });
  it("writes nothing when the member declines the step-up or lets it expire", async () => {
    const table = await host();
    const denied = await api("gatherings/" + table.id + "/request", "ari", "POST", { plusOnes: 0 });
    expect((await approve("ari", denied.body.id, "deny")).body.status).toBe("denied");
    expect(await db.select().from(s.gatheringAttendees)).toHaveLength(1);
    const expired = await api("gatherings/" + table.id + "/request", "ari", "POST", {
      plusOnes: 0,
    });
    await db
      .update(s.agentApprovals)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(s.agentApprovals.id, expired.body.id));
    const late = await approve("ari", expired.body.id);
    expect(late.status).toBe(409);
    expect(await db.select().from(s.gatheringAttendees)).toHaveLength(1);
    expect((await record(table.name)).attendees).toEqual(["kenji.tokyo." + PARENT]);
  });
  it("counts plus-ones against seats and closes at full", async () => {
    const table = await host("kenji", 3);
    const maya = await api("gatherings/" + table.id + "/request", "maya", "POST", { plusOnes: 1 });
    await approve("maya", maya.body.id);
    const attendee = (await api("gatherings/" + table.id, "kenji")).body.attendees.find(
      (a: { role: string }) => a.role === "member",
    );
    const ok = await api("gatherings/" + table.id + "/approve", "kenji", "POST", {
      attendeeId: attendee.id,
    });
    await approve("kenji", ok.body.id);
    expect((await api("gatherings/" + table.id, "kenji")).body.status).toBe("full");
    const full = await api("gatherings/" + table.id + "/request", "ari", "POST", { plusOnes: 0 });
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe("TABLE_CLOSED");
    const left = await api("gatherings/" + table.id + "/leave", "maya", "POST", {});
    expect(left.body.status).toBe("open");
    expect((await record(table.name)).attendees).toEqual(["kenji.tokyo." + PARENT]);
    const again = await api("gatherings/" + table.id + "/request", "ari", "POST", { plusOnes: 1 });
    expect(again.status).toBe(201);
  });
  it("hides tables across a block and lets the host decline or close", async () => {
    const table = await host();
    await api("blocks", "kenji", "POST", { targetId: DEMO_IDS.ari });
    expect((await api("gatherings?city=tokyo", "ari")).body.items).toHaveLength(0);
    expect((await api("gatherings/" + table.id, "ari")).status).toBe(404);
    expect(
      (await api("gatherings/" + table.id + "/request", "ari", "POST", { plusOnes: 0 })).status,
    ).toBe(404);
    const maya = await api("gatherings/" + table.id + "/request", "maya", "POST", { plusOnes: 0 });
    await approve("maya", maya.body.id);
    const attendee = (await api("gatherings/" + table.id, "kenji")).body.attendees.find(
      (a: { role: string }) => a.role === "member",
    );
    const declined = await api("gatherings/" + table.id + "/decline", "kenji", "POST", {
      attendeeId: attendee.id,
    });
    expect(declined.status).toBe(200);
    expect(
      (await api("gatherings/" + table.id + "/request", "maya", "POST", { plusOnes: 0 })).body.error
        .code,
    ).toBe("REQUEST_CLOSED");
    const closed = await api("gatherings/" + table.id + "/close", "kenji", "POST", {});
    expect(closed.body.status).toBe("closed");
    expect((await record(table.name)).status).toBe("closed");
    const cancelled = await api("gatherings/" + table.id + "/cancel", "kenji", "POST", {});
    expect(cancelled.body.status).toBe("cancelled");
    expect(await chain().readText(table.name, "friendship.table")).toBeNull();
  });
});

describe("split the bill", () => {
  it("computes equal shares with the host absorbing plus-ones and rounding", () => {
    const even = computeShares({
      totalCents: 10000,
      members: [
        { id: "host", plusOnes: 0 },
        { id: "a", plusOnes: 1 },
        { id: "b", plusOnes: 0 },
      ],
      hostId: "host",
    });
    expect(even.unitCents).toBe(2500);
    expect(even.shares.get("a")).toBe(2500);
    expect(even.shares.get("b")).toBe(2500);
    expect(even.hostCents).toBe(5000);
    const odd = computeShares({
      totalCents: 10001,
      members: [
        { id: "host", plusOnes: 0 },
        { id: "a", plusOnes: 1 },
        { id: "b", plusOnes: 0 },
      ],
      hostId: "host",
    });
    expect(odd.unitCents).toBe(2501);
    expect(odd.hostCents).toBe(4999);
    const tiny = computeShares({
      totalCents: 2,
      members: [
        { id: "host", plusOnes: 0 },
        { id: "a", plusOnes: 0 },
        { id: "b", plusOnes: 0 },
        { id: "c", plusOnes: 0 },
      ],
      hostId: "host",
    });
    expect(tiny.hostCents).toBeGreaterThanOrEqual(0);
    expect(tiny.unitCents * 3 + tiny.hostCents).toBe(2);
  });
  it("resolves the host address from the name, ignores hints, settles on verified transfers", async () => {
    const table = await host();
    const maya = await api("gatherings/" + table.id + "/request", "maya", "POST", { plusOnes: 1 });
    await approve("maya", maya.body.id);
    const attendee = (await api("gatherings/" + table.id, "kenji")).body.attendees.find(
      (a: { role: string }) => a.role === "member",
    );
    const ok = await api("gatherings/" + table.id + "/approve", "kenji", "POST", {
      attendeeId: attendee.id,
    });
    await approve("kenji", ok.body.id);
    expect(
      (await api("gatherings/" + table.id + "/split", "maya", "POST", { totalCents: 12000 }))
        .status,
    ).toBe(403);
    const started = await api("gatherings/" + table.id + "/split", "kenji", "POST", {
      totalCents: 12000,
    });
    expect(started.status).toBe(200);
    expect(started.body.split.status).toBe("pending");
    expect(started.body.split.unitCents).toBe(4000);
    expect(started.body.split.hostCents).toBe(8000);
    expect(started.body.split.mine).toBeNull();
    const mine = (await api("gatherings/" + table.id, "maya")).body.split.mine;
    expect(mine.shareCents).toBe(4000);
    expect(mine.payTo).toBe("0x" + "3".padStart(40, "0"));
    expect(mine.payToName).toBe("kenji.tokyo." + PARENT);
    expect(mine.amountBaseUnits).toBe("40000000");
    expect(mine.verified).toBe(false);
    const hint = await api("gatherings/" + table.id + "/split/paid", "maya", "POST", {
      txHash: "0x" + "a".repeat(64),
    });
    expect(hint.status).toBe(200);
    expect(hint.body.split.mine.paidTx).toBe("0x" + "a".repeat(64));
    expect(hint.body.split.mine.verified).toBe(false);
    expect(hint.body.split.status).toBe("pending");
    expect(
      (
        await api("gatherings/" + table.id + "/split/paid", "ari", "POST", {
          txHash: "0x" + "b".repeat(64),
        })
      ).status,
    ).toBe(404);
    const paid = await api("gatherings/" + table.id + "/split/simulate", "maya", "POST", {});
    expect(paid.status).toBe(200);
    expect(paid.body.split.mine.verified).toBe(true);
    expect(paid.body.split.status).toBe("settled");
    expect(
      (await api("gatherings/" + table.id + "/split", "kenji", "POST", { totalCents: 500 })).body
        .error.code,
    ).toBe("SPLIT_EXISTS");
  });
});
