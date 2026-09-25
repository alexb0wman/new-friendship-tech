import { and, eq, gt, lte, or, asc, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PLAN } from "@/lib/constants";
import { getDb } from "@/server/db";
import * as s from "@/server/db/schema";
import { applyWrite, audit } from "@/server/db/write";
import { nextPeriod } from "@/server/membership";
import { invariant, AppError } from "@/server/errors";
import { isDemo } from "@/server/config";
import { paymentAdapter, checkoutStatus, demoTransactionHash } from "./adapter";
import { verifyEvidence } from "./verification";

export const invoiceSchema = z.object({ idempotencyKey: z.string().uuid(), sourceWallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((v) => v.toLowerCase()) }).strict();
export function invoiceDTO(row: typeof s.invoices.$inferSelect) {
  return { id: row.id, status: row.status === "quoted" && row.quoteExpiresAt <= new Date() ? "expired" : row.status, usdCents: row.usdCents, quoteExpiresAt: row.quoteExpiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(), settledAt: row.settledAt?.toISOString() ?? null, sourceTx: row.sourceTx,
    destinationTx: row.destinationTx, failureCode: row.failureCode, provider: row.provider, demo: row.provider === "demo" };
}
export async function getInvoice(actorId: string, id: string) {
  const [row] = await (await getDb()).select().from(s.invoices).where(and(eq(s.invoices.id, id), eq(s.invoices.userId, actorId)));
  invariant(row, "NOT_FOUND", "Invoice not found.", 404); return invoiceDTO(row);
}
export async function createInvoice(actorId: string, body: z.infer<typeof invoiceSchema>) {
  const db = await getDb();
  const [existing] = await db.select().from(s.invoices).where(and(eq(s.invoices.userId, actorId), eq(s.invoices.idempotencyKey, body.idempotencyKey)));
  if (existing) return invoiceDTO(existing);
  invariant(checkoutStatus().enabled, "CHECKOUT_UNAVAILABLE", checkoutStatus().reason, 503);
  const [wallet] = await db.select().from(s.walletLinks).where(and(eq(s.walletLinks.userId, actorId), eq(s.walletLinks.address, body.sourceWallet)));
  invariant(wallet, "WALLET_UNVERIFIED", "Select a verified wallet linked to your account.", 403);
  const adapter = paymentAdapter();
  const quote = await adapter.quote(wallet.address, PLAN.usdCents);
  return applyWrite(actorId, "invoice.create", body.idempotencyKey, async (tx) => {
    await tx.select({ id: s.users.id }).from(s.users).where(eq(s.users.id, actorId)).for("update");
    const [again] = await tx.select().from(s.invoices).where(and(eq(s.invoices.userId, actorId), eq(s.invoices.idempotencyKey, body.idempotencyKey)));
    if (again) return invoiceDTO(again);
    const [pending] = await tx.select().from(s.invoices).where(and(eq(s.invoices.userId, actorId), inFlight())).limit(1);
    invariant(!pending, "PENDING_INVOICE", "Finish or wait for your existing invoice before starting another.", 409);
    const [row] = await tx.insert(s.invoices).values({ userId: actorId, idempotencyKey: body.idempotencyKey,
      planVersion: PLAN.version, usdCents: PLAN.usdCents, provider: adapter.name, quote: quote.obligation, quoteExpiresAt: quote.expiresAt }).returning();
    return invoiceDTO(row);
  });
}
function inFlight() { return or(and(eq(s.invoices.status, "quoted"), gt(s.invoices.quoteExpiresAt, new Date())), eq(s.invoices.status, "submitted"), eq(s.invoices.status, "confirming"), eq(s.invoices.status, "review_required")); }

export async function recordSubmission(actorId: string, id: string, sourceTx: string, providerOrderId: string) {
  await applyWrite(actorId, "invoice.submit_hint", id, async (tx) => {
    const [invoice] = await tx.select().from(s.invoices).where(and(eq(s.invoices.id, id), eq(s.invoices.userId, actorId))).for("update");
    invariant(invoice, "NOT_FOUND", "Invoice not found.", 404);
    if (invoice.sourceTx === sourceTx) return;
    invariant(invoice.status === "quoted" && !invoice.sourceTx, "INVOICE_STATE", "This invoice already has a submission.", 409);
    invariant(invoice.quoteExpiresAt > new Date(), "QUOTE_EXPIRED", "This quote expired before submission. Contact support if you already paid.", 409);
    // Hints only: the worker must independently prove attribution and settlement.
    await tx.update(s.invoices).set({ sourceTx, providerOrderId, status: "submitted" }).where(eq(s.invoices.id, id));
    await tx.insert(s.jobs).values({ invoiceId: id }).onConflictDoNothing();
  });
  return getInvoice(actorId, id);
}

export async function simulatePayment(actorId: string, id: string) {
  invariant(isDemo(), "NOT_FOUND", "Not found.", 404);
  await applyWrite(actorId, "demo.payment.submit", id, async (tx) => {
    const [row] = await tx.select().from(s.invoices).where(and(eq(s.invoices.id, id), eq(s.invoices.userId, actorId))).for("update");
    invariant(row && row.provider === "demo", "NOT_FOUND", "Demo invoice not found.", 404);
    if (row.status === "settled" || row.sourceTx) return;
    invariant(row.status === "quoted" && row.quoteExpiresAt > new Date(), "QUOTE_EXPIRED", "This quote expired. Create a new invoice.", 409);
    await tx.update(s.invoices).set({ status: "submitted", sourceTx: demoTransactionHash() }).where(eq(s.invoices.id, id));
    await tx.insert(s.jobs).values({ invoiceId: id }).onConflictDoNothing();
  });
  await reconcileInvoice(id);
  return getInvoice(actorId, id);
}
export async function reconcileInvoice(id: string) {
  const db = await getDb();
  const [snapshot] = await db.select().from(s.invoices).where(eq(s.invoices.id, id));
  invariant(snapshot, "NOT_FOUND", "Invoice not found.", 404);
  if (snapshot.status === "settled") return;
  invariant(["submitted", "confirming", "review_required"].includes(snapshot.status), "INVOICE_STATE", "Invoice has not been submitted.", 409);
  const evidence = await paymentAdapter(snapshot.provider).inspect(snapshot);
  if (!evidence) return;
  const verified = verifyEvidence(snapshot.quote, evidence);
  await db.transaction(async (tx) => {
    // User first, invoice second: concurrent renewals cannot overlap.
    await tx.select({ id: s.users.id }).from(s.users).where(eq(s.users.id, snapshot.userId)).for("update");
    const [invoice] = await tx.select().from(s.invoices).where(eq(s.invoices.id, id)).for("update");
    if (invoice.status === "settled") return;
    invariant(invoice.status !== "refunded" && invoice.status !== "failed", "INVOICE_STATE", "Invoice cannot settle.", 409);
    const [used] = await tx.select().from(s.settlements).where(eq(s.settlements.settlementKey, verified.key));
    invariant(!used || used.invoiceId === id, "PAYMENT_REPLAY", "This settlement has already been used.", 409);
    const [latest] = await tx.select().from(s.entitlements).where(eq(s.entitlements.userId, invoice.userId)).orderBy(desc(s.entitlements.endsAt)).limit(1);
    const period = nextPeriod(new Date(), latest?.endsAt);
    await tx.insert(s.settlements).values({ invoiceId: id, settlementKey: verified.key, chainId: evidence.chainId, txHash: evidence.txHash, evidenceHash: verified.hash });
    await tx.insert(s.entitlements).values({ userId: invoice.userId, invoiceId: id, source: invoice.provider === "demo" ? "demo_payment" : "payment", ...period });
    await tx.update(s.invoices).set({ status: "settled", settledAt: new Date(), destinationTx: evidence.txHash, failureCode: null }).where(eq(s.invoices.id, id));
    await tx.update(s.jobs).set({ status: "done", leaseUntil: null, leaseOwner: null }).where(eq(s.jobs.invoiceId, id));
    await audit(tx, null, invoice.provider === "demo" ? "demo.payment.settled" : "payment.settled", id);
  });
}
export async function runWorkerOnce(owner = randomUUID()) {
  const db = await getDb(), now = new Date();
  const job = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(s.jobs).where(and(lte(s.jobs.runAfter, now),
      or(eq(s.jobs.status, "ready"), and(eq(s.jobs.status, "running"), lte(s.jobs.leaseUntil, now)))))
      .orderBy(asc(s.jobs.runAfter)).limit(1).for("update", { skipLocked: true });
    if (!row) return null;
    await tx.update(s.jobs).set({ status: "running", leaseOwner: owner, leaseUntil: new Date(Date.now() + 7 * 60000), attempts: row.attempts + 1 }).where(eq(s.jobs.id, row.id));
    return { ...row, attempts: row.attempts + 1 };
  });
  if (!job) return false;
  try {
    await reconcileInvoice(job.invoiceId);
    const [invoice] = await db.select().from(s.invoices).where(eq(s.invoices.id, job.invoiceId));
    if (invoice.status === "settled") return true;
    throw new AppError("PENDING", "Still pending.", 409, true);
  } catch (error) {
    const code = error instanceof AppError ? error.code : "PROVIDER_ERROR";
    const terminal = ["WRONG_CHAIN", "WRONG_RECIPIENT", "WRONG_ASSET", "WRONG_PAYER", "WRONG_QUOTE", "UNDERPAID", "PAYMENT_REPLAY"].includes(code) || job.attempts >= 12;
    await applyWrite(null, "payment.reconcile_retry", job.invoiceId, async (tx) => {
      await tx.update(s.jobs).set({ status: terminal ? "review" : "ready", leaseOwner: null, leaseUntil: null, lastError: code,
        runAfter: new Date(Date.now() + Math.min(300000, 10000 * 2 ** Math.min(job.attempts, 5))) }).where(and(eq(s.jobs.id, job.id), eq(s.jobs.leaseOwner, owner)));
      if (terminal) await tx.update(s.invoices).set({ status: "review_required", failureCode: code }).where(and(eq(s.invoices.id, job.invoiceId), neSettled()));
    });
    return true;
  }
}
function neSettled() { return and(or(eq(s.invoices.status, "submitted"), eq(s.invoices.status, "confirming"), eq(s.invoices.status, "review_required"))); }
