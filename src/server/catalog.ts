import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, inArray, gt, asc, or, ilike } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import * as s from "./db/schema";
import { membership, requireMember } from "./membership";
import { applyWrite } from "./db/write";
import { invariant } from "./errors";
import type { Category, Place } from "@/lib/types";

export function rankPlaces(
  items: Place[],
  interests: string[],
  intents: string[],
  neighborhood: string,
) {
  return items
    .map((place) => {
      const interest = place.tags.find((tag) => interests.includes(tag));
      const intent = place.tags.find((tag) => intents.includes(tag));
      const nearby = place.neighborhood === neighborhood;
      return {
        ...place,
        reasons: [
          interest ? "Matches " + interest : null,
          intent ? "Good for " + intent.toLowerCase() : null,
          nearby ? "Your selected neighborhood" : null,
        ]
          .filter((item): item is string => !!item)
          .slice(0, 2),
        score: (interest ? 3 : 0) + (intent ? 2 : 0) + (nearby ? 1 : 0),
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map(({ score: _score, ...place }) => place);
}
function redact(place: Place): Place {
  return {
    ...place,
    name: "", 
    note: "",
    mapUrl: "",
    sourceUrl: "",
    photo: place.photo ? { ...place.photo, credit: "" } : undefined,
    locked: true,
  };
}
let photoMap: Map<string, NonNullable<Place["photo"]>> | null = null;
async function photosBySlug() {
  if (photoMap) return photoMap;
  photoMap = new Map();
  try {
    const catalog = JSON.parse(await readFile(join(process.cwd(), "content/asia-catalog.json"), "utf8")) as {
      places?: { slug: string; photo?: Place["photo"] }[];
    };
    for (const place of catalog.places ?? []) {
      if (place.photo?.src) photoMap.set(place.slug, place.photo);
    }
  } catch {
    photoMap = new Map();
  }
  return photoMap;
}
function placeDTO(row: typeof s.places.$inferSelect): Place {
  return {
    id: row.id,
    slug: row.slug,
    city: row.city,
    name: row.name,
    neighborhood: row.neighborhood,
    category: row.category,
    note: row.note,
    tags: row.tags,
    mapUrl: row.mapUrl,
    sourceUrl: row.sourceUrl,
    price: row.price,
    preview: row.preview,
    fixture: row.fixture,
    artwork: row.artwork,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}
export async function listCities() {
  return (await getDb())
    .select()
    .from(s.cities)
    .where(eq(s.cities.published, true))
    .orderBy(asc(s.cities.name));
}
export async function publishedCity(slug: string) {
  const [city] = await (
    await getDb()
  )
    .select()
    .from(s.cities)
    .where(and(eq(s.cities.slug, slug), eq(s.cities.published, true)));
  invariant(city, "NOT_FOUND", "This city is not published yet.", 404);
  return city;
}
export async function listPlaces(user: s.UserRow | null, params: URLSearchParams) {
  const db = await getDb(),
    city = params.get("city") ?? "tokyo";
  await publishedCity(city);
  const paid = user ? (await membership(user.id)).active : false;
  const category = params.get("category"),
    area = params.get("neighborhood"),
    query = params.get("q")?.slice(0, 80);
  const rows = await db
    .select()
    .from(s.places)
    .where(
      and(
        eq(s.places.city, city),
        eq(s.places.published, true),
        paid ? undefined : eq(s.places.preview, true),
        category && category !== "All" ? eq(s.places.category, category as Category) : undefined,
        area && !area.startsWith("Anywhere") ? eq(s.places.neighborhood, area) : undefined,
        query
          ? or(
              ilike(s.places.name, "%" + query + "%"),
              ilike(s.places.neighborhood, "%" + query + "%"),
            )
          : undefined,
      ),
    )
    .orderBy(asc(s.places.name))
    .limit(60);
  const saved = user ? await db.select().from(s.saves).where(eq(s.saves.userId, user.id)) : [];
  const savedIds = new Set(saved.map((row) => row.placeId));
  const page = Math.max(Number(params.get("page") ?? 1) || 1, 1);
  if (!paid && page > 1) return { items: [], access: "preview", locked: true, city };
  const items = rankPlaces(
    rows.map((row) => ({
      ...placeDTO(row),
      photo: (await photosBySlug()).get(row.slug),
      saved: savedIds.has(row.id),
    })),
    user?.interests ?? [],
    user?.intents ?? [],
    user?.neighborhood ?? "",
  ).map((place) => (paid ? place : redact(place)));
  return { items, access: paid ? "all_access" : "preview", city };
}
export async function getPlace(user: s.UserRow | null, slug: string) {
  const db = await getDb();
  const [place] = await db
    .select()
    .from(s.places)
    .where(and(eq(s.places.slug, slug), eq(s.places.published, true)))
    .limit(1);
  invariant(place, "NOT_FOUND", "Place not found.", 404);
  await publishedCity(place.city);
  if (!place.preview) {
    invariant(user, "UNAUTHENTICATED", "Sign in to see this place.", 401);
    await requireMember(user.id);
  }
  const [saved] = user
    ? await db
        .select()
        .from(s.saves)
        .where(and(eq(s.saves.userId, user.id), eq(s.saves.placeId, place.id)))
    : [];
  const dto = { ...placeDTO(place), photo: (await photosBySlug()).get(place.slug), saved: !!saved };
  const paid = user ? (await membership(user.id)).active : false;
  return paid ? dto : redact(dto);
}
export async function listEvents(user: s.UserRow | null, city = "tokyo") {
  await publishedCity(city);
  const db = await getDb();
  const rows = await db
    .select()
    .from(s.events)
    .where(
      and(eq(s.events.city, city), eq(s.events.published, true), gt(s.events.endsAt, new Date())),
    )
    .orderBy(asc(s.events.startsAt))
    .limit(50);
  const saved = user ? await db.select().from(s.saves).where(eq(s.saves.userId, user.id)) : [];
  return rows.map((row) => ({
    ...row,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    saved: saved.some((item) => item.eventId === row.id),
  }));
}
export const saveSchema = z.object({
  type: z.enum(["place", "event", "content"]),
  id: z.string().uuid(),
  saved: z.boolean(),
});
export async function setSave(userId: string, data: z.infer<typeof saveSchema>) {
  const db = await getDb();
  if (data.type === "content") {
    const [item] = await db
      .select()
      .from(s.contentItems)
      .where(and(eq(s.contentItems.id, data.id), eq(s.contentItems.status, "published")))
      .limit(1);
    invariant(item, "NOT_FOUND", "Item not found.", 404);
    await applyWrite(userId, data.saved ? "save.add" : "save.remove", data.id, async (tx) => {
      if (!data.saved)
        await tx
          .delete(s.saves)
          .where(and(eq(s.saves.userId, userId), eq(s.saves.contentId, data.id)));
      else
        await tx
          .insert(s.saves)
          .values({ userId, contentId: data.id })
          .onConflictDoNothing();
    });
    return;
  }
  const table = data.type === "place" ? s.places : s.events;
  const [target] = await db
    .select()
    .from(table)
    .where(and(eq(table.id, data.id), eq(table.published, true)))
    .limit(1);
  invariant(target, "NOT_FOUND", "Item not found.", 404);
  await publishedCity(target.city);
  // Removing an existing save remains available after membership expiry.
  if (data.saved && data.type === "place") await requireMember(userId);
  await applyWrite(userId, data.saved ? "save.add" : "save.remove", data.id, async (tx) => {
    if (!data.saved)
      await tx
        .delete(s.saves)
        .where(
          and(
            eq(s.saves.userId, userId),
            data.type === "place" ? eq(s.saves.placeId, data.id) : eq(s.saves.eventId, data.id),
          ),
        );
    else
      await tx
        .insert(s.saves)
        .values({
          userId,
          placeId: data.type === "place" ? data.id : null,
          eventId: data.type === "event" ? data.id : null,
        })
        .onConflictDoNothing();
  });
}
export async function savedItems(userId: string) {
  const db = await getDb();
  const rows = await db.select().from(s.saves).where(eq(s.saves.userId, userId)).limit(200);
  const placeIds = rows.map((row) => row.placeId).filter((id): id is string => !!id);
  const eventIds = rows.map((row) => row.eventId).filter((id): id is string => !!id);
  const contentIds = rows.map((row) => row.contentId).filter((id): id is string => !!id);
  const cities = await listCities(),
    cityIds = cities.map((city) => city.slug);
  if (!cityIds.length) return { places: [], events: [], content: [] };
  const paid = (await membership(userId)).active;
  const places = placeIds.length
    ? await db
        .select()
        .from(s.places)
        .where(
          and(
            inArray(s.places.id, placeIds),
            inArray(s.places.city, cityIds),
            eq(s.places.published, true),
          ),
        )
    : [];
  const events = eventIds.length
    ? await db
        .select()
        .from(s.events)
        .where(
          and(
            inArray(s.events.id, eventIds),
            inArray(s.events.city, cityIds),
            eq(s.events.published, true),
          ),
        )
    : [];
  return {
    places: places.map((row) => ({
      ...placeDTO(row),
      note: paid || row.preview ? row.note : "Renew All Access to reopen this recommendation.",
      saved: true,
    })),
    events: events.map((row) => ({
      ...row,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      saved: true,
    })),
    content: contentIds.length
      ? (
          await db
            .select()
            .from(s.contentItems)
            .where(
              and(
                inArray(s.contentItems.id, contentIds),
                eq(s.contentItems.status, "published"),
              ),
            )
        ).map((row) => ({
          id: row.id,
          slug: row.slug,
          kind: row.kind,
          section: row.section,
          title: row.title,
          summary: row.summary,
          body: row.body,
          sourceUrl: row.sourceUrl,
          city: row.city,
          tags: row.tags,
          status: row.status,
          featuredRank: row.featuredRank,
          fixture: row.fixture,
          publishedAt: row.publishedAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          saved: true,
        }))
      : [],
  };
}
