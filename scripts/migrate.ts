import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadRuntimeSecrets } from "../src/server/secrets";
async function main() {
  await loadRuntimeSecrets();
  if (process.env.APP_MODE !== "production" || !process.env.DATABASE_URL)
    throw new Error(
      "Set production mode and a dedicated DATABASE_URL. Demo migrates automatically in memory.",
    );
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    // Same advisory key in every deployment. Fail quickly if another migrator owns it.
    const result = await client.query("SELECT pg_try_advisory_lock(721004319) AS acquired");
    if (!result.rows[0].acquired) throw new Error("Another migration is running");
    try {
      await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
      console.log("Migrations applied successfully.");
    } finally {
      await client.query("SELECT pg_advisory_unlock(721004319)");
    }
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error(
    "Migration failed. Review database permissions, migration compatibility, and backup status. No credentials are printed.",
  );
  process.exitCode = 1;
});
