import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import * as s from "./db/schema";

type Catalog = {
  cities: { slug: string; name: string; timezone: string }[];
  places: {
    slug: string;
    city: string;
    name: string;
    neighborhood: string;
    category: "Eat" | "Coffee" | "Drink" | "Work" | "Culture" | "Outdoors" | "Meet";
    note: string;
    mapUrl: string;
    sourceUrl: string;
  }[];
};

export async function loadSavedCatalog() {
  const db = await getDb();
  const file = join(process.cwd(), "content/asia-catalog.json");
  const catalog = JSON.parse(await readFile(file, "utf8")) as Catalog;
  for (const city of catalog.cities) {
    await db
      .insert(s.cities)
      .values({ slug: city.slug, name: city.name, timezone: city.timezone, published: true })
      .onConflictDoUpdate({
        target: s.cities.slug,
        set: { name: city.name, timezone: city.timezone, published: true },
      });
  }
  const preview = new Map<string, number>();
  for (const place of catalog.places) {
    const shown = preview.get(place.city) ?? 0;
    preview.set(place.city, shown + 1);
    await db
      .insert(s.places)
      .values({
        slug: place.slug,
        city: place.city,
        name: place.name,
        neighborhood: place.neighborhood,
        category: place.category,
        note: place.note,
        tags: [],
        mapUrl: place.mapUrl,
        sourceUrl: place.sourceUrl || place.mapUrl,
        preview: shown < 6,
        published: true,
        fixture: false,
      })
      .onConflictDoNothing();
  }
  return { cities: catalog.cities.length, places: catalog.places.length };
}

export async function catalogLoaded() {
  const db = await getDb();
  const rows = await db.execute(sql`select count(*)::int as n from places where fixture = false`);
  const n = Array.isArray(rows) ? rows[0] : (rows as { rows?: { n: number }[] }).rows?.[0];
  return Number(n && "n" in n ? n.n : 0) > 0;
}
