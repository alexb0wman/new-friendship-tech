import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import * as s from "./db/schema";
import { applyWrite } from "./db/write";
import { invariant } from "./errors";
import { CATEGORIES } from "@/lib/constants";
import { invoiceDTO } from "./payments/service";

export function requireAdmin(user: s.UserRow) {
  invariant(user.admin && !user.suspended, "FORBIDDEN", "Administrator access required.", 403);
}
const httpsUrl = z
  .url()
  .refine((value) => new URL(value).protocol === "https:", "Use an HTTPS URL.");
export const placeInput = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(100),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(120),
    city: z.string().regex(/^[a-z-]+$/),
    neighborhood: z.string().trim().min(1).max(60),
    category: z.enum(CATEGORIES),
    note: z.string().trim().min(20).max(2000),
    tags: z.array(z.string().trim().min(1).max(40)).max(12),
    mapUrl: httpsUrl.refine(
      (value) =>
        ["www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"].includes(
          new URL(value).hostname,
        ),
      "Use an official Google Maps URL.",
    ),
    sourceUrl: httpsUrl,
    price: z.string().max(40).nullable().default(null),
    preview: z.boolean().default(false),
    published: z.boolean().default(false),
    reviewedAt: z.iso.datetime().nullable(),
    artwork: z
      .string()
      .regex(/^0[1-6]$/)
      .default("01"),
  })
  .strict()
  .refine(
    (value) => !value.published || !!value.reviewedAt,
    "A review date is required before publication.",
  );
export async function adminOverview(actor: s.UserRow) {
  requireAdmin(actor);
  const db = await getDb();
  return {
    places: await db.select().from(s.places).limit(100),
    events: await db.select().from(s.events).limit(100),
    content: await db
      .select()
      .from(s.contentItems)
      .orderBy(desc(s.contentItems.updatedAt))
      .limit(200),
    reports: await db.select().from(s.reports).orderBy(desc(s.reports.createdAt)).limit(100),
    invoices: (
      await db.select().from(s.invoices).orderBy(desc(s.invoices.createdAt)).limit(100)
    ).map(invoiceDTO),
    users: await db
      .select({
        id: s.users.id,
        name: s.users.name,
        suspended: s.users.suspended,
        fixture: s.users.fixture,
      })
      .from(s.users)
      .limit(100),
  };
}
export async function upsertPlace(actor: s.UserRow, body: z.infer<typeof placeInput>) {
  requireAdmin(actor);
  const { id, reviewedAt, ...input } = body;
  return applyWrite(actor.id, id ? "place.update" : "place.create", id ?? body.slug, async (tx) => {
    const [city] = await tx.select().from(s.cities).where(eq(s.cities.slug, body.city));
    invariant(city, "NOT_FOUND", "Create the city metadata before adding content.", 404);
    if (id) {
      const [row] = await tx
        .update(s.places)
        .set({ ...input, reviewedAt: reviewedAt ? new Date(reviewedAt) : null })
        .where(eq(s.places.id, id))
        .returning();
      invariant(row, "NOT_FOUND", "Place not found.", 404);
      return row;
    }
    return (
      await tx
        .insert(s.places)
        .values({ ...input, reviewedAt: reviewedAt ? new Date(reviewedAt) : null })
        .returning()
    )[0];
  });
}
export async function suspendMember(actor: s.UserRow, id: string, suspended: boolean) {
  requireAdmin(actor);
  invariant(actor.id !== id, "SELF_SUSPEND", "You cannot suspend your own account.", 422);
  await applyWrite(actor.id, suspended ? "user.suspend" : "user.restore", id, async (tx) => {
    const rows = await tx
      .update(s.users)
      .set({ suspended })
      .where(eq(s.users.id, id))
      .returning({ id: s.users.id });
    invariant(rows.length, "NOT_FOUND", "Member not found.", 404);
    if (suspended)
      await tx.update(s.nowPosts).set({ active: false }).where(eq(s.nowPosts.userId, id));
  });
}
export async function resolveReport(actor: s.UserRow, id: string) {
  requireAdmin(actor);
  await applyWrite(actor.id, "report.resolve", id, async (tx) => {
    const updated = await tx
      .update(s.reports)
      .set({ status: "resolved" })
      .where(eq(s.reports.id, id))
      .returning({ id: s.reports.id });
    invariant(updated.length, "NOT_FOUND", "Report not found.", 404);
  });
}
export async function retryInvoice(actor: s.UserRow, id: string) {
  requireAdmin(actor);
  await applyWrite(actor.id, "invoice.retry", id, async (tx) => {
    const [invoice] = await tx.select().from(s.invoices).where(eq(s.invoices.id, id)).for("update");
    invariant(
      invoice && ["review_required", "submitted", "confirming"].includes(invoice.status),
      "INVOICE_STATE",
      "This invoice cannot be queued.",
      409,
    );
    await tx
      .insert(s.jobs)
      .values({ invoiceId: id })
      .onConflictDoUpdate({
        target: s.jobs.invoiceId,
        set: {
          status: "ready",
          attempts: 0,
          runAfter: new Date(),
          leaseOwner: null,
          leaseUntil: null,
        },
      });
  });
}
