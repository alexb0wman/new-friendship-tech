import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { handleApi } from "@/server/router";
import { getDb, closeDb, type Database } from "@/server/db";
import { DEMO_IDS, seedDemo } from "@/server/db/seed";
import { demoSession } from "@/server/auth";
import * as s from "@/server/db/schema";
import { membership } from "@/server/membership";
import { reconcileInvoice, runWorkerOnce } from "@/server/payments/service";

let db: Database;
const cookies: Record<string, string> = {};
async function api(
  path: string,
  actor?: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const request = new Request("http://localhost:3000/api/" + path, {
    method,
    headers: {
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
      ...(actor ? { Cookie: cookies[actor] } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const response = await handleApi(request);
  return { status: response.status, body: await response.json(), headers: response.headers };
}
async function invoice(actor = "alex") {
  const me = await api("me", actor);
  return api("invoices", actor, "POST", {
    sourceWallet: me.body.walletAddresses[0],
    idempotencyKey: randomUUID(),
  });
}
beforeAll(async () => {
  db = await getDb();
  for (const actor of ["alex", "maya", "admin"])
    cookies[actor] = "nftech_demo=" + (await demoSession(actor));
}, 30000);
beforeEach(async () => {
  await db.execute(sql.raw("TRUNCATE users, cities, audit_log, rate_limits CASCADE"));
  await seedDemo(db);
});
afterAll(closeDb);

describe("real API handlers against migrated PostgreSQL in PGlite", () => {
  it("serves only preview records publicly and gates paid records on the server", async () => {
    const preview = await api("places");
    const paid = await api("places", "maya");
    expect(preview.status).toBe(200);
    expect(preview.body.items).toHaveLength(6);
    expect(paid.body.items).toHaveLength(24);
    expect(preview.body.items.every((p: { preview: boolean }) => p.preview)).toBe(true);
    const locked = paid.body.items.find((p: { preview: boolean }) => !p.preview);
    expect((await api("places/" + locked.slug)).status).toBe(401);
    expect((await api("places/" + locked.slug, "alex")).status).toBe(403);
    expect((await api("places?city=seoul", "maya")).status).toBe(404);
  });
  it("rejects unauthenticated, tampered-cookie, and cross-origin access", async () => {
    expect((await api("me")).status).toBe(401);
    expect(
      (await api("me", undefined, "GET", undefined, { Cookie: "nftech_demo=forged" })).status,
    ).toBe(401);
    expect(
      (
        await api(
          "me/visibility",
          "alex",
          "PATCH",
          { visible: true },
          { Origin: "https://evil.example" },
        )
      ).status,
    ).toBe(403);
    const denied = await api("me/visibility", "alex", "PATCH", { visible: true }, { Origin: "" });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("X-Correlation-ID")).toBeTruthy();
  });
  it("bounds payload size and refuses client-side role escalation", async () => {
    expect((await api("me/profile", "alex", "PATCH", { name: "x".repeat(17000) })).status).toBe(
      413,
    );
    const profile = {
      name: "Alex Builder",
      role: "Founder",
      bio: "Hello Tokyo",
      interests: ["AI"],
      intents: ["Coffee"],
      neighborhood: "Shibuya",
      city: "tokyo",
      visible: true,
      adult: true,
    };
    expect((await api("me/profile", "alex", "PATCH", { ...profile, admin: true })).status).toBe(
      422,
    );
    expect((await api("me/profile", "alex", "PATCH", profile)).status).toBe(200);
    expect((await api("me", "alex")).body.user.onboarded).toBe(true);
    expect((await api("admin", "alex")).status).toBe(403);
  });
  it("returns public profile fields without private identity or contacts", async () => {
    const directory = await api("members", "maya");
    expect(directory.status).toBe(200);
    const data = JSON.stringify(directory.body);
    for (const secret of [
      "demo_member_",
      "authSubject",
      "wrappedKey",
      "walletAddresses",
      "ciphertext",
    ])
      expect(data).not.toContain(secret);
    expect((await api("members", "alex")).status).toBe(403);
    expect((await api("admin", "admin")).status).toBe(200);
  });
  it("lets a free recipient consent, then exposes contacts only to the accepted pair", async () => {
    const body = {
      recipientId: DEMO_IDS.alex,
      context: "Coffee after the build session?",
      idempotencyKey: randomUUID(),
    };
    const created = await api("requests", "maya", "POST", body);
    expect(created.status).toBe(201);
    expect((await api("requests", "alex")).body.items[0].contact).toBeNull();
    expect((await api("requests/" + created.body.id + "/accept", "admin", "POST")).status).toBe(
      404,
    );
    expect((await api("requests/" + created.body.id + "/accept", "maya", "POST")).status).toBe(403);
    expect((await api("requests/" + created.body.id + "/accept", "alex", "POST")).status).toBe(200);
    expect((await api("requests/" + created.body.id + "/accept", "alex", "POST")).status).toBe(200);
    expect((await api("requests", "alex")).body.items[0].contact.value).toBe("demo_member_2");
    expect((await api("requests", "admin")).body.items).toHaveLength(0);
    expect(await db.select().from(s.connections)).toHaveLength(1);
    await db
      .update(s.entitlements)
      .set({ endsAt: new Date(Date.now() - 1000) })
      .where(eq(s.entitlements.userId, DEMO_IDS.maya));
    expect((await api("requests", "maya")).body.items[0].contact.value).toBe("demo_member_1");
  });
  it("honors withdrawn contact-sharing consent immediately", async () => {
    const created = await api("requests", "maya", "POST", {
      recipientId: DEMO_IDS.alex,
      context: "A coffee together?",
      idempotencyKey: randomUUID(),
    });
    await api("requests/" + created.body.id + "/accept", "alex", "POST");
    await api("me/contact", "maya", "PUT", {
      type: "Telegram",
      value: "private_handle",
      shareOnAcceptance: false,
    });
    expect((await api("requests", "alex")).body.items[0].contact).toBeNull();
    const [stored] = await db
      .select()
      .from(s.privateContacts)
      .where(eq(s.privateContacts.userId, DEMO_IDS.maya));
    expect(JSON.stringify(stored)).not.toContain("private_handle");
  });
  it("deduplicates retries and rejects reciprocal pending requests", async () => {
    const body = {
      recipientId: DEMO_IDS.admin,
      context: "Meet after the conference?",
      idempotencyKey: randomUUID(),
    };
    const replies = await Promise.all([
      api("requests", "maya", "POST", body),
      api("requests", "maya", "POST", body),
    ]);
    expect(replies.map((r) => r.status)).toEqual([201, 201]);
    expect(replies[0].body.id).toBe(replies[1].body.id);
    expect((await membership(DEMO_IDS.maya)).remainingRequests).toBe(9);
    expect(
      (
        await api("requests", "admin", "POST", {
          ...body,
          recipientId: DEMO_IDS.maya,
          idempotencyKey: randomUUID(),
        })
      ).status,
    ).toBe(409);
  });
  it("enforces ten requests per period, including cancelled requests", async () => {
    for (let i = 0; i < 10; i++) {
      const id = randomUUID();
      await db
        .insert(s.users)
        .values({ id, authSubject: "test:" + id, name: "Recipient " + i, visible: true });
      const r = await api("requests", "maya", "POST", {
        recipientId: id,
        context: "A useful introduction",
        idempotencyKey: randomUUID(),
      });
      expect(r.status).toBe(201);
      await api("requests/" + r.body.id + "/cancel", "maya", "POST");
    }
    expect((await membership(DEMO_IDS.maya)).remainingRequests).toBe(0);
    expect(
      (
        await api("requests", "maya", "POST", {
          recipientId: DEMO_IDS.admin,
          context: "One request too many",
          idempotencyKey: randomUUID(),
        })
      ).status,
    ).toBe(429);
  });
  it("blocks profile discovery, invitations and contact retrieval in both directions", async () => {
    const r = await api("requests", "maya", "POST", {
      recipientId: DEMO_IDS.alex,
      context: "Coffee together later?",
      idempotencyKey: randomUUID(),
    });
    await api("requests/" + r.body.id + "/accept", "alex", "POST");
    expect((await api("blocks", "alex", "POST", { targetId: DEMO_IDS.maya })).status).toBe(200);
    expect((await api("members/" + DEMO_IDS.alex, "maya")).status).toBe(404);
    expect((await api("requests", "alex")).body.items).toHaveLength(0);
    expect((await api("requests", "maya")).body.items).toHaveLength(0);
    expect(
      (
        await api("requests", "maya", "POST", {
          recipientId: DEMO_IDS.alex,
          context: "Should be blocked",
          idempotencyKey: randomUUID(),
        })
      ).status,
    ).toBe(404);
  });
  it("expires Right now on the server and closes invitations when visibility is withdrawn", async () => {
    const body = {
      kind: "Coffee",
      neighborhood: "Shibuya",
      city: "tokyo",
      note: "Coffee after building?",
      hours: 2,
    };
    const first = await api("now", "maya", "POST", body);
    expect(first.status).toBe(201);
    expect((await api("now", "alex", "POST", body)).status).toBe(403);
    expect((await api("now", "maya", "POST", { ...body, hours: 7 })).status).toBe(422);
    const second = await api("now", "maya", "POST", body);
    const active = await db.select().from(s.nowPosts).where(eq(s.nowPosts.userId, DEMO_IDS.maya));
    expect(active.filter((p) => p.active)).toHaveLength(1);
    await db
      .update(s.nowPosts)
      .set({ startsAt: new Date(Date.now() - 7200000), expiresAt: new Date(Date.now() - 1000) })
      .where(eq(s.nowPosts.id, second.body.id));
    expect(
      (await api("now", "admin")).body.items.some((p: { id: string }) => p.id === second.body.id),
    ).toBe(false);
    expect(
      (
        await api("requests", "admin", "POST", {
          recipientId: DEMO_IDS.maya,
          nowPostId: second.body.id,
          context: "An expired invitation",
          idempotencyKey: randomUUID(),
        })
      ).body.error.code,
    ).toBe("INVITATION_EXPIRED");
    await api("now", "maya", "POST", body);
    await api("me/visibility", "maya", "PATCH", { visible: false });
    expect(
      (await api("now", "admin")).body.items.some(
        (p: { owner: { id: string } }) => p.owner.id === DEMO_IDS.maya,
      ),
    ).toBe(false);
  });
  it("preserves saved places after expiry and permits removal", async () => {
    const place = (await api("places", "maya")).body.items.find(
      (p: { preview: boolean }) => !p.preview,
    );
    expect(
      (await api("saves", "maya", "POST", { type: "place", id: place.id, saved: true })).status,
    ).toBe(200);
    await db
      .update(s.entitlements)
      .set({ endsAt: new Date(Date.now() - 1000) })
      .where(eq(s.entitlements.userId, DEMO_IDS.maya));
    const saved = (await api("saves", "maya")).body.places;
    expect(saved).toHaveLength(1);
    expect(saved[0].note).not.toBe(place.note);
    expect(
      (await api("saves", "maya", "POST", { type: "place", id: place.id, saved: false })).status,
    ).toBe(200);
    expect((await api("saves", "maya")).body.places).toHaveLength(0);
  });
  it("uses a global entitlement for newly published cities", async () => {
    await db.update(s.cities).set({ published: true }).where(eq(s.cities.slug, "seoul"));
    const [tokyo] = await db.select().from(s.places).limit(1);
    await db
      .insert(s.places)
      .values({ ...tokyo, id: randomUUID(), slug: "test-seoul", city: "seoul", preview: false });
    expect((await api("places?city=seoul", "maya")).body.items).toHaveLength(1);
    expect((await api("places?city=seoul", "alex")).body.items).toHaveLength(0);
  });
  it("owns invoices server-side and refuses an unverified source wallet", async () => {
    const r = await invoice();
    expect(r.status).toBe(201);
    expect(r.body.usdCents).toBe(1900);
    expect((await api("invoices/" + r.body.id, "maya")).status).toBe(404);
    expect((await api("invoices/" + r.body.id + "/simulate", "maya", "POST")).status).toBe(404);
    expect(
      (
        await api("invoices", "alex", "POST", {
          sourceWallet: "0x" + "9".repeat(40),
          idempotencyKey: randomUUID(),
        })
      ).body.error.code,
    ).toBe("WALLET_UNVERIFIED");
    expect((await invoice()).body.error.code).toBe("PENDING_INVOICE");
  });
  it("settles once across parallel callbacks, refreshes and worker retries", async () => {
    const created = await invoice();
    const id = created.body.id;
    const results = await Promise.all([
      api("invoices/" + id + "/simulate", "alex", "POST"),
      api("invoices/" + id + "/simulate", "alex", "POST"),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    await reconcileInvoice(id);
    expect((await api("me", "alex")).body.membership.active).toBe(true);
    expect(await db.select().from(s.settlements)).toHaveLength(1);
    expect(
      await db.select().from(s.entitlements).where(eq(s.entitlements.userId, DEMO_IDS.alex)),
    ).toHaveLength(1);
    expect(await runWorkerOnce()).toBe(false);
    expect((await api("places", "alex")).body.items).toHaveLength(24);
  });
  it("appends renewal after paid-through without resetting this period request quota", async () => {
    await api("requests", "maya", "POST", {
      recipientId: DEMO_IDS.alex,
      context: "Say hello in Tokyo",
      idempotencyKey: randomUUID(),
    });
    const before = await membership(DEMO_IDS.maya),
      created = await invoice("maya");
    await api("invoices/" + created.body.id + "/simulate", "maya", "POST");
    const after = await membership(DEMO_IDS.maya);
    expect(after.current?.id).toBe(before.current?.id);
    expect(after.remainingRequests).toBe(9);
    expect(new Date(after.paidThrough!).getTime() - new Date(before.paidThrough!).getTime()).toBe(
      30 * 86400000,
    );
  });
  it("never activates access from an unverified client success field or submit hint", async () => {
    const created = await invoice();
    expect(
      (await api("invoices/" + created.body.id + "/submit", "alex", "POST", { success: true }))
        .status,
    ).toBe(422);
    const r = await api("invoices/" + created.body.id + "/submit", "alex", "POST", {
      sourceTx: "0x" + "a".repeat(64),
      providerOrderId: "test-order",
    });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("submitted");
    expect((await membership(DEMO_IDS.alex)).active).toBe(false);
    expect(await runWorkerOnce()).toBe(true);
    expect((await membership(DEMO_IDS.alex)).active).toBe(true);
  });
  it("requires a review before publishing and prevents suspended users signing in", async () => {
    const place = {
      name: "Reviewed venue",
      slug: "reviewed-venue",
      city: "tokyo",
      neighborhood: "Shibuya",
      category: "Coffee",
      note: "An original reviewed recommendation with sufficient context.",
      tags: ["Coffee"],
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Tokyo",
      sourceUrl: "https://example.com/source",
      published: true,
      reviewedAt: null,
    };
    expect((await api("admin/places", "admin", "POST", place)).status).toBe(422);
    expect(
      (await api("admin/places", "admin", "POST", { ...place, published: false })).status,
    ).toBe(200);
    expect(
      (await api("admin/users/suspend", "admin", "POST", { id: DEMO_IDS.alex, suspended: true }))
        .status,
    ).toBe(200);
    expect((await api("me", "alex")).status).toBe(403);
    expect(
      (await api("admin/users/suspend", "admin", "POST", { id: DEMO_IDS.admin, suspended: true }))
        .status,
    ).toBe(422);
  });
  it("retains late payment references for review without granting access", async () => {
    const created = await invoice();
    await db
      .update(s.invoices)
      .set({ quoteExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(s.invoices.id, created.body.id));
    const r = await api("invoices/" + created.body.id + "/submit", "alex", "POST", {
      sourceTx: "0x" + "b".repeat(64),
      providerOrderId: "late-order",
    });
    expect(r.body.status).toBe("review_required");
    expect(r.body.failureCode).toBe("LATE_SUBMISSION");
    expect((await membership(DEMO_IDS.alex)).active).toBe(false);
    expect(await runWorkerOnce()).toBe(false);
    expect((await invoice()).body.error.code).toBe("PENDING_INVOICE");
    expect((await api("invoices", "maya")).body.items).toHaveLength(0);
    expect((await api("invoices", "alex")).body.items).toHaveLength(1);
  });
  it("allows a member to remove their contact and reverse only their own block", async () => {
    await api("blocks", "alex", "POST", { targetId: DEMO_IDS.maya });
    expect((await api("blocks", "alex")).body.items).toHaveLength(1);
    await api("blocks/" + DEMO_IDS.maya, "admin", "DELETE");
    expect((await api("blocks", "alex")).body.items).toHaveLength(1);
    await api("blocks/" + DEMO_IDS.maya, "alex", "DELETE");
    expect((await api("blocks", "alex")).body.items).toHaveLength(0);
    expect((await api("me/contact", "alex", "DELETE")).status).toBe(200);
    expect((await api("me", "alex")).body.hasContact).toBe(false);
    expect((await api("me", "maya")).body.hasContact).toBe(true);
  });
  it("keeps ENS disabled until the Sepolia integration is configured", async () => {
    expect((await api("ens/link", "maya", "POST", { name: "friend.eth" })).status).toBe(503);
  });
});
