import { randomUUID } from "node:crypto";
import { getDb, type Tx } from "./index";
import { auditLog } from "./schema";
export async function audit(
  tx: Tx,
  actorId: string | null,
  action: string,
  entityId: string,
  correlationId: string = randomUUID(),
) {
  await tx.insert(auditLog).values({ actorId, action, entityId, correlationId });
}
export async function applyWrite<T>(
  actorId: string | null,
  action: string,
  entityId: string,
  fn: (tx: Tx) => Promise<T>,
  correlationId?: string,
): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const result = await fn(tx);
    await audit(tx, actorId, action, entityId, correlationId);
    return result;
  });
}
