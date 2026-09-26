import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";

describe("journal-driven production migration path", () => {
  it("registers every SQL migration in order", async () => {
    const folder = join(process.cwd(), "drizzle");
    const files = (await readdir(folder)).filter((file) => file.endsWith(".sql")).sort();
    const journal = JSON.parse(await readFile(join(folder, "meta/_journal.json"), "utf8")) as {
      entries: { idx: number; tag: string; when: number }[];
    };
    expect(journal.entries.map((entry) => `${entry.tag}.sql`)).toEqual(files);
    expect(journal.entries.map((entry) => entry.idx)).toEqual(files.map((_, index) => index));
    for (let index = 1; index < journal.entries.length; index++)
      expect(journal.entries[index].when).toBeGreaterThan(journal.entries[index - 1].when);
  });

  it("applies the journal once, exposes the live integration schema, and preserves data on rerun", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });
    const options = { migrationsFolder: join(process.cwd(), "drizzle") };
    try {
      // Demo initialization uses client.exec on a file glob. This deliberately uses the same
      // journal and statement splitting as the production migrator, with PGlite as the driver.
      await migrate(db, options);
      const journal = JSON.parse(
        await readFile(join(options.migrationsFolder, "meta/_journal.json"), "utf8"),
      ) as { entries: unknown[] };
      const before = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
      );
      expect(before.rows[0].count).toBe(journal.entries.length);

      // Selecting schema columns catches omissions that a database-only health check misses.
      expect(await db.select().from(schema.worldProofRequests)).toEqual([]);
      expect(await db.select().from(schema.agentApprovals)).toEqual([]);
      expect(await db.select().from(schema.gatherings)).toEqual([]);
      expect(await db.select().from(schema.gatheringAttendees)).toEqual([]);
      expect(await db.select().from(schema.contentItems)).toEqual([]);
      expect(await db.select().from(schema.ensJobs)).toEqual([]);
      expect(await db.select().from(schema.entitlements)).toEqual([]);
      const [user] = await db
        .insert(schema.users)
        .values({ authSubject: "did:privy:migration-check", name: "Migration check" })
        .returning();
      await migrate(db, options);
      const after = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
      );
      expect(after.rows[0].count).toBe(before.rows[0].count);
      expect((await db.select().from(schema.users)).map((row) => row.id)).toEqual([user.id]);
    } finally {
      await client.close();
    }
  });
});
