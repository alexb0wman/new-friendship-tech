import { readFile } from "node:fs/promises";
import { contentBundle } from "../src/server/content";
import { getDb, closeDb } from "../src/server/db";
import * as s from "../src/server/db/schema";
import { audit } from "../src/server/db/write";
import { loadRuntimeSecrets } from "../src/server/secrets";
async function main() {
  const file = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!file)
    throw new Error(
      "Usage: npm run content:import -- content/your-reviewed-content.json [--apply]",
    );
  const input = contentBundle.parse(JSON.parse(await readFile(file, "utf8")));
  const urls = [
    ...input.places.flatMap((p) => [p.sourceUrl, p.mapUrl]),
    ...input.events.flatMap((e) => [e.sourceUrl, e.registrationUrl]),
  ];
  if (
    urls.some((url) =>
      ["example.com", "example.org", "example.net"].includes(new URL(url).hostname),
    )
  )
    throw new Error("Replace placeholder source URLs before import.");
  console.log(
    JSON.stringify({
      valid: true,
      cities: input.cities.length,
      places: input.places.length,
      events: input.events.length,
      apply: process.argv.includes("--apply"),
    }),
  );
  if (!process.argv.includes("--apply")) return;
  await loadRuntimeSecrets();
  if (process.env.APP_MODE !== "production")
    throw new Error(
      "Content import writes only to the dedicated production-mode database. Demo is memory-only.",
    );
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const city of input.cities)
      await tx
        .insert(s.cities)
        .values(city)
        .onConflictDoUpdate({ target: s.cities.slug, set: city });
    for (const place of input.places) {
      const { id: _id, reviewedAt, ...fields } = place;
      const row = { ...fields, reviewedAt: reviewedAt ? new Date(reviewedAt) : null };
      // Never replace an existing ID; existing saves stay attached across repeat imports.
      await tx.insert(s.places).values(row).onConflictDoUpdate({ target: s.places.slug, set: row });
    }
    for (const event of input.events) {
      const row = { ...event, startsAt: new Date(event.startsAt), endsAt: new Date(event.endsAt) };
      await tx.insert(s.events).values(row).onConflictDoUpdate({ target: s.events.id, set: row });
    }
    await audit(
      tx,
      null,
      "content.import",
      String(input.places.length) + " places; " + String(input.events.length) + " events",
    );
  });
  console.log("Content imported transactionally. Existing place IDs were preserved.");
}
main()
  .catch((error) => {
    console.error(
      error?.name === "ZodError"
        ? "Content does not match the import schema."
        : error instanceof Error && /^(Usage:|Replace|Content import)/.test(error.message)
          ? error.message
          : "Content import failed; no credentials printed.",
    );
    process.exitCode = 1;
  })
  .finally(closeDb);
