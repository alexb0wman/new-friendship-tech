import { PGlite } from "@electric-sql/pglite";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { config } from "@/server/config";
import * as schema from "./schema";
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Runtime = { database?: Promise<Database>; pglite?: PGlite; pool?: Pool };
const globalDb = globalThis as typeof globalThis & { __nftechDb?: Runtime };
const runtime = (globalDb.__nftechDb ??= {});
export async function getDb(): Promise<Database> {
  return (runtime.database ??= initialize());
}
async function initialize(): Promise<Database> {
  const env = config();
  if (env.demo || process.env.NFT_EMBEDDED_DB === "true") {
    const client = new PGlite();
    runtime.pglite = client;
    const migrations = (await readdir(join(process.cwd(), "drizzle")))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of migrations) {
      const content = await readFile(join(process.cwd(), "drizzle", file), "utf8");
      await client.exec(content);
    }
    const db = pgliteDrizzle(client, { schema });
    if (env.demo) {
      const { seedDemo } = await import("./seed");
      await seedDemo(db);
    } else if (process.env.NFT_EMBEDDED_DB === "true") {
      const { loadSavedCatalog } = await import("../catalog-import");
      await loadSavedCatalog();
    }
    return db;
  }
  if (!env.databaseUrl)
    throw new Error("DATABASE_URL is required. Use npm run demo for an isolated local preview.");
  const pool = new Pool({
    connectionString: env.databaseUrl,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  runtime.pool = pool;
  return pgDrizzle(pool, { schema });
}
export async function closeDb() {
  await runtime.pglite?.close();
  await runtime.pool?.end();
  runtime.database = undefined;
  runtime.pglite = undefined;
  runtime.pool = undefined;
}
