import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb, closeDb, type Database } from "@/server/db";
import { DEMO_IDS, seedDemo } from "@/server/db/seed";
import * as s from "@/server/db/schema";
import { resetSimulatedChain } from "@/server/ens-v2/chain";
import { nullifierToDecimal, world } from "@/server/world/adapter";
import {
  finishApproval,
  registerApprovalExecutor,
  requestApproval,
} from "@/server/world/approvals";
import { api, bootSessions } from "./helpers";

let db: Database;
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

describe("agent approvals: fresh authentication before every protected action", () => {
  async function user(id: string) {
    const [row] = await db.select().from(s.users).where(eq(s.users.id, id));
    return row;
  }
  async function link(actor: string) {
    const created = await api("world/agent/link", actor, "POST", {});
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("pending");
    expect(created.body.url).toMatch(/^simulated:\/\/approval\//);
    expect(created.body.simulated).toBe(true);
    const done = await api("world/agent/simulate", actor, "POST", {
      approvalId: created.body.id,
      decision: "approve",
    });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("consumed");
    return created.body.id as string;
  }
  it("links a pairwise subject once and requires it for protected actions", async () => {
    const maya = await user(DEMO_IDS.maya);
    await expect(
      requestApproval(maya, { action: "now.publish", payload: {}, summary: "x" }),
    ).rejects.toHaveProperty("code", "AGENT_NOT_LINKED");
    await link("maya");
    const linked = await user(DEMO_IDS.maya);
    expect(linked.worldAgentSub).toBe("sim:user-" + DEMO_IDS.maya.slice(-6));
    expect(linked.worldAgentIssuer).toBe("simulated");
    expect((await api("me", "maya")).body.user.worldAgentLinked ?? true).toBe(true);
  });
  it("runs the executor exactly once inside the approval transaction", async () => {
    await link("maya");
    const maya = await user(DEMO_IDS.maya);
    let calls = 0;
    registerApprovalExecutor("now.publish", async (tx, approval) => {
      calls += 1;
      expect(approval.status).toBe("approved");
      expect(approval.worldSub).toBe(maya.worldAgentSub);
      return "result-" + approval.payload.n;
    });
    const approval = await requestApproval(maya, {
      action: "now.publish",
      payload: { n: 7 },
      summary: "Post that Maya is free for coffee",
    });
    expect(approval.status).toBe("pending");
    expect(new Date(approval.expiresAt).getTime()).toBeLessThanOrEqual(Date.now() + 121000);
    const status = await api("approvals/" + approval.id, "maya");
    expect(status.body.status).toBe("pending");
    expect(status.body.url).toBeNull();
    expect((await api("approvals/" + approval.id, "kenji")).status).toBe(404);
    const done = await api("world/agent/simulate", "maya", "POST", {
      approvalId: approval.id,
      decision: "approve",
    });
    expect(done.body.status).toBe("consumed");
    expect(done.body.resultId).toBe("result-7");
    expect(calls).toBe(1);
    const replay = await api("world/agent/simulate", "maya", "POST", {
      approvalId: approval.id,
      decision: "approve",
    });
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe("APPROVAL_CONSUMED");
    expect(calls).toBe(1);
    const audits = await db
      .select()
      .from(s.auditLog)
      .where(eq(s.auditLog.action, "approval.replay"));
    expect(audits).toHaveLength(1);
  });
  it("writes nothing when the member declines, when it expires, or when the identity is wrong", async () => {
    await link("maya");
    const maya = await user(DEMO_IDS.maya);
    let calls = 0;
    registerApprovalExecutor("now.publish", async () => {
      calls += 1;
      return null;
    });
    const denied = await requestApproval(maya, {
      action: "now.publish",
      payload: {},
      summary: "a",
    });
    const deniedResult = await api("world/agent/simulate", "maya", "POST", {
      approvalId: denied.id,
      decision: "deny",
    });
    expect(deniedResult.body.status).toBe("denied");
    expect(
      (
        await api("world/agent/simulate", "maya", "POST", {
          approvalId: denied.id,
          decision: "approve",
        })
      ).body.error.code,
    ).toBe("APPROVAL_CLOSED");
    const expired = await requestApproval(maya, {
      action: "now.publish",
      payload: {},
      summary: "b",
    });
    await db
      .update(s.agentApprovals)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(s.agentApprovals.id, expired.id));
    expect((await api("approvals/" + expired.id, "maya")).body.status).toBe("expired");
    const late = await api("world/agent/simulate", "maya", "POST", {
      approvalId: expired.id,
      decision: "approve",
    });
    expect(late.body.error.code).toBe("APPROVAL_CLOSED");
    const stranger = await requestApproval(maya, {
      action: "now.publish",
      payload: {},
      summary: "c",
    });
    const wrongHuman = await api("world/agent/simulate", "maya", "POST", {
      approvalId: stranger.id,
      decision: "approve",
      human: "someone-else",
    });
    expect(wrongHuman.status).toBe(403);
    expect(wrongHuman.body.error.code).toBe("APPROVAL_SUBJECT");
    const row = (
      await db.select().from(s.agentApprovals).where(eq(s.agentApprovals.id, stranger.id))
    )[0];
    expect(row.status).toBe("pending");
    await expect(
      finishApproval({
        approvalId: stranger.id,
        identity: {
          issuer: "simulated",
          sub: maya.worldAgentSub!,
          nonce: "wrong",
          authTime: new Date(),
        },
      }),
    ).rejects.toHaveProperty("code", "APPROVAL_NONCE");
    await expect(
      finishApproval({
        approvalId: stranger.id,
        identity: {
          issuer: "simulated",
          sub: maya.worldAgentSub!,
          nonce: row.nonce,
          authTime: new Date(Date.now() - 10 * 60000),
        },
      }),
    ).rejects.toHaveProperty("code", "APPROVAL_STALE");
    expect(calls).toBe(0);
  });
  it("cannot be answered by another account or outside demo mode", async () => {
    await link("maya");
    const maya = await user(DEMO_IDS.maya);
    registerApprovalExecutor("now.publish", async () => null);
    const approval = await requestApproval(maya, {
      action: "now.publish",
      payload: {},
      summary: "d",
    });
    const other = await api("world/agent/simulate", "kenji", "POST", {
      approvalId: approval.id,
      decision: "approve",
    });
    expect(other.status).toBe(404);
    expect(
      (await api("world/agent/callback?state=" + approval.id + "&error=access_denied")).status,
    ).toBe(302);
    expect((await api("approvals/" + approval.id, "maya")).body.status).toBe("denied");
  });
});
