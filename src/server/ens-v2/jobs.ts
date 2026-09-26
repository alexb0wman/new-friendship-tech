import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { and, asc, eq, lte, or } from "drizzle-orm";
import { getDb, type Tx } from "@/server/db";
import * as s from "@/server/db/schema";
import { applyWrite } from "@/server/db/write";
import { AppError } from "@/server/errors";
import { isDemo } from "@/server/config";
import type { EnsJobKind, EnsJobSigner } from "@/lib/types";
import type { TxSubmission } from "./types";

const executingJob = new AsyncLocalStorage<{ id: string; owner: string }>();
/** Persist each stage before receipt polling so a pending transaction is never resubmitted. */
export async function ensJobCheckpoint<T>(stage: string, create: () => Promise<T>): Promise<T> {
  const context = executingJob.getStore();
  if (!context) return create();
  const db = await getDb();
  const [job] = await db.select().from(s.ensJobs).where(eq(s.ensJobs.id, context.id));
  if (!job || job.leaseOwner !== context.owner)
    throw new AppError("ENS_JOB_LEASE", "The ENS job lease changed.", 409, true);
  const checkpoints = (job.payload.checkpoints ?? {}) as Record<string, unknown>;
  if (Object.hasOwn(checkpoints, stage)) return checkpoints[stage] as T;
  const result = await create();
  await applyWrite(null, "ens.job.checkpoint", context.id, async (tx) => {
    const [current] = await tx
      .select()
      .from(s.ensJobs)
      .where(eq(s.ensJobs.id, context.id))
      .for("update");
    if (!current || current.leaseOwner !== context.owner)
      throw new AppError("ENS_JOB_LEASE", "The ENS job lease changed.", 409, true);
    await tx
      .update(s.ensJobs)
      .set({
        payload: {
          ...current.payload,
          checkpoints: {
            ...((current.payload.checkpoints ?? {}) as Record<string, unknown>),
            [stage]: result,
          },
        },
      })
      .where(eq(s.ensJobs.id, context.id));
  });
  return result;
}
export const ensJobSubmission = (stage: string, create: () => Promise<TxSubmission>) =>
  ensJobCheckpoint<TxSubmission>(stage, create);

/**
 * Chain work runs as leased jobs, the same shape as the payments worker: lease seven minutes,
 * exponential backoff capped at five minutes, twelve attempts or a terminal code lands in review.
 * Handlers own their entity's final state (they run their own applyWrite); this file only owns
 * the job row. Demo mode drains the queue inline so the UI sees results without a worker process.
 */
export type JobHandler = (job: s.EnsJobRow) => Promise<{ txHash?: string | null }>;
const handlers = new Map<EnsJobKind, JobHandler>();
export function registerEnsJobHandler(kind: EnsJobKind, handler: JobHandler) {
  handlers.set(kind, handler);
}
export const TERMINAL_JOB_CODES = [
  "CHAIN_REVERT",
  "ENS_RECORD_MISMATCH",
  "ENS_TX_MISMATCH",
  "ENS_TX_FAILED",
  "TX_FAILED",
  "WRONG_RECIPIENT",
  "WRONG_PAYER",
  "WRONG_TOKEN",
  "WRONG_AMOUNT",
  "WRONG_TRANSFER",
  "WRONG_TRANSACTION",
  "OLD_TRANSACTION",
  "SPLIT_REPLAY",
  "SPLIT_LEGACY_REVIEW",
  "UNDERPAID",
  "TRIP_NO_WALLET",
  "NOT_FOUND",
];
export async function enqueueEnsJob(
  tx: Tx,
  input: {
    kind: EnsJobKind;
    signer: EnsJobSigner;
    entityId: string;
    payload?: Record<string, unknown>;
  },
) {
  const [row] = await tx
    .insert(s.ensJobs)
    .values({
      kind: input.kind,
      signer: input.signer,
      entityId: input.entityId,
      payload: input.payload ?? {},
    })
    .returning({ id: s.ensJobs.id });
  return row.id;
}
export async function runEnsWorkerOnce(owner = randomUUID()): Promise<boolean> {
  const db = await getDb(),
    now = new Date();
  const job = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(s.ensJobs)
      .where(
        and(
          lte(s.ensJobs.runAfter, now),
          or(
            eq(s.ensJobs.status, "ready"),
            and(eq(s.ensJobs.status, "running"), lte(s.ensJobs.leaseUntil, now)),
          ),
        ),
      )
      .orderBy(asc(s.ensJobs.runAfter), asc(s.ensJobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!row) return null;
    await tx
      .update(s.ensJobs)
      .set({
        status: "running",
        leaseOwner: owner,
        leaseUntil: new Date(Date.now() + 7 * 60000),
        attempts: row.attempts + 1,
      })
      .where(eq(s.ensJobs.id, row.id));
    return { ...row, attempts: row.attempts + 1 };
  });
  if (!job) return false;
  const handler = handlers.get(job.kind);
  try {
    if (!handler) throw new AppError("JOB_UNHANDLED", "No handler for " + job.kind, 500);
    const result = await executingJob.run({ id: job.id, owner }, () => handler(job));
    await applyWrite(null, "ens.job.done", job.id, async (tx) => {
      await tx
        .update(s.ensJobs)
        .set({
          status: "done",
          leaseOwner: null,
          leaseUntil: null,
          txHash: result.txHash ?? job.txHash,
          verifiedAt: new Date(),
          lastError: null,
        })
        .where(and(eq(s.ensJobs.id, job.id), eq(s.ensJobs.leaseOwner, owner)));
    });
    return true;
  } catch (error) {
    const code = error instanceof AppError ? error.code : "CHAIN_ERROR";
    const terminal = TERMINAL_JOB_CODES.includes(code) || job.attempts >= 12;
    await applyWrite(null, "ens.job.retry", job.id, async (tx) => {
      await tx
        .update(s.ensJobs)
        .set({
          status: terminal ? "review" : "ready",
          leaseOwner: null,
          leaseUntil: null,
          lastError: code,
          runAfter: new Date(Date.now() + Math.min(300000, 10000 * 2 ** Math.min(job.attempts, 5))),
        })
        .where(and(eq(s.ensJobs.id, job.id), eq(s.ensJobs.leaseOwner, owner)));
    });
    return true;
  }
}
/** Demo and tests only: run every due job now, in this process. Production uses the worker loop. */
export async function drainEnsJobs(limit = 50) {
  if (!isDemo()) return;
  for (let i = 0; i < limit; i++) if (!(await runEnsWorkerOnce())) return;
}
export async function jobsForEntity(entityId: string) {
  return (await getDb())
    .select()
    .from(s.ensJobs)
    .where(eq(s.ensJobs.entityId, entityId))
    .orderBy(asc(s.ensJobs.createdAt));
}
