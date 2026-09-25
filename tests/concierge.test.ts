import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, closeDb, type Database } from "@/server/db";
import { DEMO_IDS, seedDemo } from "@/server/db/seed";
import * as s from "@/server/db/schema";
import { chain, resetSimulatedChain } from "@/server/ens-v2/chain";
import { handleMcp } from "@/server/ens-world/concierge/mcp";
import { RuleBrain, tokyoTimeToday } from "@/server/ens-world/concierge/brain";
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
  await api("world/agent/simulate", actor, "POST", {
    approvalId: created.body.id,
    decision: "approve",
  });
}
async function approve(actor: string, approvalId: string) {
  return api("world/agent/simulate", actor, "POST", { approvalId, decision: "approve" });
}
async function mcp(method: string, params?: unknown, id: number | string = 1) {
  const response = await handleMcp(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }),
  );
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
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
  await link("maya");
  await link("kenji");
});
afterAll(closeDb);

describe("concierge: one agent, one scoped key, every action approved", () => {
  it("posts a Right now invitation only after approval, then writes friendship.now from the concierge", async () => {
    await db.update(s.nowPosts).set({ active: false }).where(eq(s.nowPosts.userId, DEMO_IDS.maya));
    const until = inHours(3);
    const proposal = await api("concierge/now", "maya", "POST", {
      city: "tokyo",
      kind: "Coffee",
      area: "Shibuya",
      until,
    });
    expect(proposal.status).toBe(201);
    expect(proposal.body.action).toBe("now.publish");
    const mayaName = "maya.tokyo." + PARENT;
    expect(await chain().readText(mayaName, "friendship.now")).toBeNull();
    expect(
      (await api("now?city=tokyo", "kenji")).body.items.some(
        (p: { owner: { id: string } }) => p.owner.id === DEMO_IDS.maya,
      ),
    ).toBe(false);
    const done = await approve("maya", proposal.body.id);
    expect(done.body.status).toBe("consumed");
    const posts = await db.select().from(s.nowPosts).where(eq(s.nowPosts.userId, DEMO_IDS.maya));
    expect(posts.filter((post) => post.active)).toHaveLength(1);
    expect(done.body.resultId).toBe(posts.find((post) => post.active)!.id);
    const now = JSON.parse((await chain().readText(mayaName, "friendship.now")) ?? "null");
    expect(now).toMatchObject({ kind: "Coffee", area: "Shibuya" });
    const [trip] = await db.select().from(s.trips).where(eq(s.trips.userId, DEMO_IDS.maya));
    expect(trip.nowTx).toMatch(/^0x[0-9a-f]{64}$/);
    expect((await chain().receipt(trip.nowTx!)).from).toBe(chain().addresses.concierge);
    const me = await api("trips/me", "maya");
    expect(me.body.trip.now).toMatchObject({ kind: "Coffee", area: "Shibuya" });
    const members = await api("members?city=tokyo", "kenji");
    const maya = members.body.items.find((m: { id: string }) => m.id === DEMO_IDS.maya);
    expect(maya.tripName).toBe(mayaName);
    expect(maya.verifiedHuman).toBe(true);
    expect(maya.now.kind).toBe("Coffee");
    expect(JSON.stringify(members.body)).not.toContain("0x");
  });
  it("answers the three canned prompts with names only and proposes approvals", async () => {
    const dinner = await api("gatherings", "kenji", "POST", {
      city: "tokyo",
      kind: "dinner",
      area: "Shibuya",
      startsAt: inHours(4),
      seats: 4,
    });
    const around = await api("concierge/chat", "maya", "POST", {
      city: "tokyo",
      message: "who's around tonight?",
    });
    expect(around.status).toBe(200);
    expect(around.body.reply).toContain("kenji.tokyo." + PARENT);
    expect(around.body.reply).not.toContain("0x");
    expect(around.body.approvals).toHaveLength(0);
    const find = await api("concierge/chat", "maya", "POST", {
      city: "tokyo",
      message: "find me a dinner",
    });
    expect(find.body.approvals).toHaveLength(1);
    expect(find.body.approvals[0].action).toBe("table.request");
    expect(find.body.needsLink).toBe(false);
    await approve("maya", find.body.approvals[0].id);
    const detail = await api("gatherings/" + dinner.body.id, "kenji");
    expect(
      detail.body.attendees.some(
        (a: { name: string; status: string }) =>
          a.name === "maya.tokyo." + PARENT && a.status === "requested",
      ),
    ).toBe(true);
    const post = await api("concierge/chat", "maya", "POST", {
      city: "tokyo",
      message: "post that I'm free for coffee until 18:00",
    });
    expect(post.body.approvals).toHaveLength(1);
    expect(post.body.approvals[0].action).toBe("now.publish");
    expect(post.body.approvals[0].summary).toContain("coffee");
    const help = await api("concierge/chat", "maya", "POST", { city: "tokyo", message: "hello?" });
    expect(help.body.approvals).toHaveLength(0);
    expect(help.body.reply).toContain("who's around tonight");
  });
  it("asks an unlinked member to connect World ID before proposing anything", async () => {
    await activate("ari", "h-ari");
    const find = await api("concierge/chat", "ari", "POST", {
      city: "tokyo",
      message: "post that I'm free for drinks until 21:00",
    });
    expect(find.body.needsLink).toBe(true);
    expect(find.body.approvals).toHaveLength(0);
    expect(
      await db.select().from(s.agentApprovals).where(eq(s.agentApprovals.userId, DEMO_IDS.ari)),
    ).toHaveLength(0);
  });
  it("turns accepting an introduction into an approved contact reveal", async () => {
    const request = await api("requests", "kenji", "POST", {
      recipientId: DEMO_IDS.maya,
      context: "Ramen after the conference?",
      idempotencyKey: randomUUID(),
    });
    const chat = await api("concierge/chat", "maya", "POST", {
      city: "tokyo",
      message: "accept my introductions",
    });
    expect(chat.body.approvals).toHaveLength(1);
    expect(chat.body.approvals[0].action).toBe("contact.reveal");
    expect((await api("requests", "kenji")).body.items[0].status).toBe("pending");
    await approve("maya", chat.body.approvals[0].id);
    const items = (await api("requests", "kenji")).body.items;
    expect(items[0].id).toBe(request.body.id);
    expect(items[0].status).toBe("accepted");
    expect(items[0].contact.value).toBe("demo_member_2");
  });
  it("parses Tokyo times and rolls to tomorrow when the time has passed", () => {
    const at = tokyoTimeToday(18, 0, new Date("2026-09-27T03:00:00Z"));
    expect(at.toISOString()).toBe("2026-09-27T09:00:00.000Z");
    const rolled = tokyoTimeToday(9, 30, new Date("2026-09-27T03:00:00Z"));
    expect(rolled.toISOString()).toBe("2026-09-28T00:30:00.000Z");
  });
  it("keeps the rule brain free of wallets and contacts", async () => {
    const out = await new RuleBrain().respond({
      user: { id: "u", name: "Maya", neighborhood: "Shibuya" },
      city: "tokyo",
      message: "who is around",
      context: {
        openTables: [],
        whoIsAround: [
          {
            name: "kenji.tokyo." + PARENT,
            now: { kind: "Drinks", area: "Nakameguro", until: inHours(2) },
          },
        ],
        myTrip: null,
        pendingRequests: [],
      },
    });
    expect(out.reply).toContain("kenji.tokyo." + PARENT);
    expect(out.proposals).toEqual([]);
  });
});

describe("MCP endpoint: read-only tools for other agents", () => {
  it("speaks JSON-RPC, lists three tools and calls them without an Origin header", async () => {
    const init = await mcp("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    expect(init.status).toBe(200);
    expect(init.body.result.serverInfo.name).toBe("friendship-concierge");
    expect(init.body.result.capabilities.tools).toBeTruthy();
    const list = await mcp("tools/list");
    expect(list.body.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "resolveTrip",
      "openTables",
      "whoIsAround",
    ]);
    await api("gatherings", "kenji", "POST", {
      city: "tokyo",
      kind: "drinks",
      area: "Nakameguro",
      startsAt: inHours(3),
      seats: 3,
    });
    const tables = await mcp("tools/call", { name: "openTables", arguments: { city: "tokyo" } });
    const parsed = JSON.parse(tables.body.result.content[0].text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].host.name).toBe("kenji.tokyo." + PARENT);
    expect(tables.body.result.content[0].text).not.toContain(DEMO_IDS.kenji);
    const trip = await mcp("tools/call", {
      name: "resolveTrip",
      arguments: { name: "maya.tokyo." + PARENT },
    });
    expect(JSON.parse(trip.body.result.content[0].text).verifiedHuman).toBe(true);
    const missing = await mcp("tools/call", {
      name: "resolveTrip",
      arguments: { name: "nobody.tokyo." + PARENT },
    });
    expect(missing.body.result.isError).toBe(true);
    const unknown = await mcp("tools/call", { name: "writeRecord", arguments: {} });
    expect(unknown.body.error.code).toBe(-32602);
    const method = await mcp("resources/list");
    expect(method.body.error.code).toBe(-32601);
    const ping = await mcp("ping");
    expect(ping.body.result).toEqual({});
    const notification = await handleMcp(
      new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      }),
    );
    expect(notification.status).toBe(202);
    expect((await handleMcp(new Request("http://localhost:3000/api/mcp"))).status).toBe(405);
  });
});
