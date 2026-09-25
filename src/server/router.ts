import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { actorFromRequest, demoSession, syncVerifiedWallets } from "./auth";
import { config, uuid, txHash } from "./config";
import { AppError, errorResponse, invariant } from "./errors";
import { assertOrigin, jsonBody, rateLimit } from "./http";
import { getDb } from "./db";
import * as s from "./db/schema";
import { applyWrite } from "./db/write";
import { DEMO_ACTORS } from "./db/seed";
import { PLAN } from "@/lib/constants";
import * as catalog from "./catalog";
import * as editorial from "./editorial";
import * as social from "./social";
import * as admin from "./admin";
import { contactSchema } from "./privacy";
import { checkoutStatus } from "./payments/adapter";
import * as payments from "./payments/service";
import * as ens from "./ens";

function ok(
  data: unknown,
  correlationId: string,
  status = 200,
  extra: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Correlation-ID": correlationId, ...extra },
  });
}
export async function handleApi(request: Request): Promise<Response> {
  const correlationId = randomUUID(),
    url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, ""),
    method = request.method;
  try {
    assertOrigin(request);
    if (path === "health" && method === "GET") {
      await (await getDb()).execute(sql.raw("select 1"));
      return ok(
        { ok: true, mode: config().demo ? "demo" : "production", at: new Date().toISOString() },
        correlationId,
      );
    }
    if (path === "config" && method === "GET")
      return ok(
        {
          demo: config().demo,
          plan: PLAN,
          checkout: checkoutStatus(),
          ensEnabled: config().ensEnabled,
          ensWriteEnabled: config().ensWriteEnabled,
          actors: config().demo ? DEMO_ACTORS : [],
        },
        correlationId,
      );
    if (path === "demo/session" && method === "POST") {
      invariant(config().demo, "NOT_FOUND", "Not found.", 404);
      const data = z
        .object({ actor: z.enum(["alex", "maya", "admin"]) })
        .parse(await jsonBody(request));
      const token = await demoSession(data.actor);
      return ok({ ok: true }, correlationId, 200, {
        "Set-Cookie": "nftech_demo=" + token + "; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800",
      });
    }
    if (path === "demo/session" && method === "DELETE") {
      invariant(config().demo, "NOT_FOUND", "Not found.", 404);
      return ok({ ok: true }, correlationId, 200, {
        "Set-Cookie": "nftech_demo=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      });
    }
    const optional =
      method === "GET" &&
      (["cities", "places", "events", "plans"].includes(path) ||
        path.startsWith("places/") ||
        path === "content" ||
        path.startsWith("content/"));
    const actor = await actorFromRequest(request, !optional);
    await rateLimit(request, actor?.id);
    if (path === "cities" && method === "GET")
      return ok({ items: await catalog.listCities() }, correlationId);
    if (path === "plans" && method === "GET")
      return ok({ plan: PLAN, checkout: checkoutStatus() }, correlationId);
    if (path === "places" && method === "GET")
      return ok(await catalog.listPlaces(actor, url.searchParams), correlationId);
    if (path.startsWith("places/") && method === "GET")
      return ok(await catalog.getPlace(actor, path.slice(7)), correlationId);
    if (path === "events" && method === "GET")
      return ok(
        { items: await catalog.listEvents(actor, url.searchParams.get("city") ?? "tokyo") },
        correlationId,
      );
    if (path === "content" && method === "GET")
      return ok(await editorial.listContent(actor, url.searchParams), correlationId);
    if (path.startsWith("content/") && method === "GET")
      return ok(await editorial.contentBySlug(actor, path.split("/")[1]), correlationId);
    invariant(actor, "UNAUTHENTICATED", "Sign in to continue.", 401);
    if (path === "me" && method === "GET") return ok(await social.me(actor), correlationId);
    if (path === "me/profile" && method === "PATCH") {
      await social.updateProfile(actor.id, social.profileSchema.parse(await jsonBody(request)));
      return ok({ ok: true }, correlationId);
    }
    if (path === "me/contact" && method === "PUT") {
      await social.updateContact(actor.id, contactSchema.parse(await jsonBody(request)));
      return ok({ ok: true }, correlationId);
    }
    if (path === "me/contact" && method === "DELETE") {
      await social.removeContact(actor.id);
      return ok({ ok: true }, correlationId);
    }
    if (path === "me/wallets" && method === "POST")
      return ok(
        { addresses: await syncVerifiedWallets(actor.id, actor.authSubject) },
        correlationId,
      );
    if (path === "me/visibility" && method === "PATCH") {
      const data = z
        .object({ visible: z.boolean() })
        .strict()
        .parse(await jsonBody(request));
      await applyWrite(actor.id, "profile.visibility", actor.id, async (tx) => {
        await tx
          .update(s.users)
          .set({ visible: data.visible, updatedAt: new Date() })
          .where(eq(s.users.id, actor.id));
        if (!data.visible)
          await tx.update(s.nowPosts).set({ active: false }).where(eq(s.nowPosts.userId, actor.id));
      });
      return ok({ ok: true }, correlationId);
    }
    if (path === "saves" && method === "GET")
      return ok(await catalog.savedItems(actor.id), correlationId);
    if (path === "saves" && method === "POST") {
      await catalog.setSave(actor.id, catalog.saveSchema.parse(await jsonBody(request)));
      return ok({ ok: true }, correlationId);
    }
    if (path === "members" && method === "GET")
      return ok({ items: await social.listMembers(actor.id, url.searchParams) }, correlationId);
    if (path.startsWith("members/") && method === "GET")
      return ok(await social.memberDetail(actor.id, uuid.parse(path.split("/")[1])), correlationId);
    if (path === "requests" && method === "GET")
      return ok({ items: await social.listRequests(actor.id) }, correlationId);
    if (path === "requests" && method === "POST")
      return ok(
        await social.createRequest(actor.id, social.requestSchema.parse(await jsonBody(request))),
        correlationId,
        201,
      );
    const requestAction = path.match(/^requests\/([^/]+)\/(accept|decline|cancel)$/);
    if (requestAction && method === "POST")
      return ok(
        await social.respondRequest(
          actor.id,
          uuid.parse(requestAction[1]),
          z.enum(["accept", "decline", "cancel"]).parse(requestAction[2]),
        ),
        correlationId,
      );
    if (path === "now" && method === "GET")
      return ok(
        { items: await social.listNow(actor.id, url.searchParams.get("city") ?? "tokyo") },
        correlationId,
      );
    if (path === "now" && method === "POST")
      return ok(
        await social.createNow(actor.id, social.nowSchema.parse(await jsonBody(request))),
        correlationId,
        201,
      );
    if (path.startsWith("now/") && method === "DELETE") {
      await social.cancelNow(actor.id, uuid.parse(path.split("/")[1]));
      return ok({ ok: true }, correlationId);
    }
    if (path === "blocks" && method === "GET")
      return ok({ items: await social.listOwnBlocks(actor.id) }, correlationId);
    if (path.startsWith("blocks/") && method === "DELETE") {
      await social.unblockMember(actor.id, uuid.parse(path.split("/")[1]));
      return ok({ ok: true }, correlationId);
    }
    if (path === "blocks" && method === "POST") {
      const data = z
        .object({ targetId: uuid })
        .strict()
        .parse(await jsonBody(request));
      await social.blockMember(actor.id, data.targetId);
      return ok({ ok: true }, correlationId);
    }
    if (path === "reports" && method === "POST") {
      const data = z
        .object({ targetId: uuid, reason: z.string().trim().min(5).max(500) })
        .strict()
        .parse(await jsonBody(request));
      invariant(data.targetId !== actor.id, "SELF_REPORT", "Choose another member.", 422);
      await applyWrite(actor.id, "report.create", data.targetId, async (tx) => {
        await tx.insert(s.reports).values({ actorId: actor.id, ...data });
      });
      return ok({ ok: true }, correlationId, 201);
    }
    if (path === "invoices" && method === "GET")
      return ok({ items: await payments.listInvoices(actor.id) }, correlationId);
    if (path === "invoices" && method === "POST") {
      await syncVerifiedWallets(actor.id, actor.authSubject);
      return ok(
        await payments.createInvoice(
          actor.id,
          payments.invoiceSchema.parse(await jsonBody(request)),
        ),
        correlationId,
        201,
      );
    }
    if (/^invoices\/[^/]+$/.test(path) && method === "GET")
      return ok(await payments.getInvoice(actor.id, uuid.parse(path.split("/")[1])), correlationId);
    if (/^invoices\/[^/]+\/simulate$/.test(path) && method === "POST")
      return ok(
        await payments.simulatePayment(actor.id, uuid.parse(path.split("/")[1])),
        correlationId,
      );

    if (/^invoices\/[^/]+\/submit$/.test(path) && method === "POST") {
      const data = z
        .object({ sourceTx: txHash, providerOrderId: z.string().min(1).max(160) })
        .strict()
        .parse(await jsonBody(request));
      return ok(
        await payments.recordSubmission(
          actor.id,
          uuid.parse(path.split("/")[1]),
          data.sourceTx,
          data.providerOrderId,
        ),
        correlationId,
      );
    }
    // No endpoint accepts "success" or client-supplied settlement evidence.

    if (path === "ens/link" && method === "POST") {
      const data = z
        .object({ name: ens.ensNameSchema })
        .strict()
        .parse(await jsonBody(request));
      return ok(await ens.linkENS(actor, data.name), correlationId);
    }
    if (path === "ens/lookup" && method === "GET")
      return ok(
        await ens.lookupMemberByENS(
          actor.id,
          ens.ensNameSchema.parse(url.searchParams.get("name")),
        ),
        correlationId,
      );
    if (path === "ens/description" && method === "POST") {
      const data = z
        .object({
          name: ens.ensNameSchema,
          description: z.string().max(160),
          consent: z.literal(true),
        })
        .strict()
        .parse(await jsonBody(request));
      return ok(
        await ens.prepareDescriptionWrite(actor, data.name, data.description, data.consent),
        correlationId,
      );
    }
    if (path === "ens/confirm" && method === "POST") {
      const data = z
        .object({ intentId: uuid, txHash })
        .strict()
        .parse(await jsonBody(request));
      return ok(await ens.confirmENSWrite(actor, data.txHash, data.intentId), correlationId);
    }
    if (path.startsWith("admin")) {
      admin.requireAdmin(actor);
      if (path === "admin" && method === "GET")
        return ok(await admin.adminOverview(actor), correlationId);
      if (path === "admin/content" && method === "POST")
        return ok(
          await editorial.upsertContent(actor, editorial.contentInput.parse(await jsonBody(request))),
          correlationId,
        );
      if (path === "admin/content/delete" && method === "POST") {
        const data = z
          .object({ id: uuid })
          .strict()
          .parse(await jsonBody(request));
        return ok(await editorial.deleteContent(actor, data.id), correlationId);
      }
      if (path === "admin/places" && method === "POST")
        return ok(
          await admin.upsertPlace(actor, admin.placeInput.parse(await jsonBody(request))),
          correlationId,
        );
      if (path === "admin/users/suspend" && method === "POST") {
        const data = z
          .object({ id: uuid, suspended: z.boolean() })
          .strict()
          .parse(await jsonBody(request));
        await admin.suspendMember(actor, data.id, data.suspended);
        return ok({ ok: true }, correlationId);
      }
      if (path === "admin/reports/resolve" && method === "POST") {
        const data = z
          .object({ id: uuid })
          .strict()
          .parse(await jsonBody(request));
        await admin.resolveReport(actor, data.id);
        return ok({ ok: true }, correlationId);
      }
      if (path === "admin/invoices/retry" && method === "POST") {
        const data = z
          .object({ id: uuid })
          .strict()
          .parse(await jsonBody(request));
        await admin.retryInvoice(actor, data.id);
        return ok({ ok: true }, correlationId);
      }
    }
    throw new AppError("NOT_FOUND", "This endpoint does not exist.", 404);
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
