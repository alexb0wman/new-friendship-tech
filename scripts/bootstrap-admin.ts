import { eq } from "drizzle-orm";
import { getDb, closeDb } from "../src/server/db";
import { users } from "../src/server/db/schema";
import { applyWrite } from "../src/server/db/write";
import { loadRuntimeSecrets } from "../src/server/secrets";
async function main() {
  const subject = process.argv.find((arg) => arg.startsWith("--subject="))?.slice(10);
  if (!subject?.startsWith("did:privy:"))
    throw new Error("Supply the intended existing Privy subject with --subject=did:privy:...");
  await loadRuntimeSecrets();
  if (process.env.APP_MODE !== "production")
    throw new Error("Use the dedicated production-mode database.");
  const db = await getDb(),
    [user] = await db.select().from(users).where(eq(users.authSubject, subject));
  if (!user || user.suspended || user.fixture)
    throw new Error("No eligible existing account. Sign in first.");
  console.log(
    JSON.stringify({
      accountId: user.id,
      alreadyAdmin: user.admin,
      apply: process.argv.includes("--apply"),
    }),
  );
  if (process.argv.includes("--apply"))
    await applyWrite(null, "admin.bootstrap", user.id, async (tx) => {
      await tx.update(users).set({ admin: true, host: true }).where(eq(users.id, user.id));
    });
}
main()
  .catch(() => {
    console.error(
      "Admin bootstrap failed. Check the existing Privy subject, mode, and database access.",
    );
    process.exitCode = 1;
  })
  .finally(closeDb);
