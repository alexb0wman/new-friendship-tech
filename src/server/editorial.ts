import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import * as s from "./db/schema";
import { applyWrite } from "./db/write";
import { invariant } from "./errors";
import type { ContentItem, ContentKind, ContentSection } from "@/lib/types";

const httpsUrl = z
  .url()
  .refine((value) => new URL(value).protocol === "https:", "Use an HTTPS URL.");
export const contentInput = z
  .object({
    id: z.string().uuid().optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(120),
    kind: z.enum(["story", "playlist", "opportunity", "company", "perk"]),
    section: z.enum(["travel", "art", "music", "tech"]),
    title: z.string().trim().min(3).max(150),
    summary: z.string().trim().min(10).max(300),
    body: z.string().trim().min(10).max(5000),
    sourceUrl: httpsUrl,
    city: z
      .string()
      .regex(/^[a-z-]+$/)
      .nullable()
      .default(null),
    tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
    status: z.enum(["draft", "published", "archived"]).default("draft"),
    featuredRank: z.number().int().min(1).max(99).nullable().default(null),
  })
  .strict();
export type ContentInput = z.infer<typeof contentInput>;

function contentDTO(row: typeof s.contentItems.$inferSelect): ContentItem {
  return {
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
  };
}

export async function listContent(
  user: s.UserRow | null,
  params: URLSearchParams,
): Promise<{ items: (ContentItem & { saved: boolean })[]; total: number }> {
  const db = await getDb();
  const section = params.get("section"),
    kind = params.get("kind"),
    city = params.get("city"),
    q = params.get("q")?.slice(0, 80),
    pageSize = Math.min(Math.max(Number(params.get("pageSize") ?? 24) || 24, 1), 48),
    page = Math.max(Number(params.get("page") ?? 1) || 1, 1);
  const where = and(
    eq(s.contentItems.status, "published"),
    section ? eq(s.contentItems.section, section as ContentSection) : undefined,
    kind ? eq(s.contentItems.kind, kind as ContentKind) : undefined,
    city ? eq(s.contentItems.city, city) : undefined,
    q
      ? sql`(${s.contentItems.title} ILIKE ${"%" + q + "%"} OR ${s.contentItems.summary} ILIKE ${"%" + q + "%"})`
      : undefined,
  );
  const [{ n: total }] = (await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.contentItems)
    .where(where)) as { n: number }[];
  const rows = await db
    .select()
    .from(s.contentItems)
    .where(where)
    .orderBy(sql`${s.contentItems.featuredRank} ASC NULLS LAST`, desc(s.contentItems.publishedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const saved = user
    ? new Set(
        (
          await db
            .select({ id: s.saves.contentId })
            .from(s.saves)
            .where(eq(s.saves.userId, user.id))
        )
          .map((row) => row.id)
          .filter((id): id is string => !!id),
      )
    : new Set<string>();
  return { items: rows.map((row) => ({ ...contentDTO(row), saved: saved.has(row.id) })), total };
}

export async function contentBySlug(user: s.UserRow | null, slug: string) {
  const db = await getDb();
  const [row] = await db.select().from(s.contentItems).where(eq(s.contentItems.slug, slug));
  invariant(row && row.status === "published", "NOT_FOUND", "This story does not exist.", 404);
  const saved = user
    ? !!(await db
        .select({ id: s.saves.id })
        .from(s.saves)
        .where(and(eq(s.saves.userId, user.id), eq(s.saves.contentId, row.id)))
        .then((r) => r.length))
    : false;
  return { ...contentDTO(row), saved };
}

export async function upsertContent(actor: s.UserRow, body: ContentInput) {
  invariant(actor.admin, "FORBIDDEN", "Administrator access required.", 403);
  const { id, ...input } = body;
  return applyWrite(
    actor.id,
    id ? "content.update" : "content.create",
    id ?? input.slug,
    async (tx) => {
      if (input.city) {
        const [city] = await tx.select().from(s.cities).where(eq(s.cities.slug, input.city));
        invariant(city, "NOT_FOUND", "That city does not exist.", 404);
      }
      const values = {
        ...input,
        publishedAt: input.status === "published" ? new Date() : undefined,
        updatedAt: new Date(),
      };
      if (id) {
        const [row] = await tx
          .update(s.contentItems)
          .set(values)
          .where(eq(s.contentItems.id, id))
          .returning();
        invariant(row, "NOT_FOUND", "That item does not exist.", 404);
        return contentDTO(row);
      }
      const [row] = await tx
        .insert(s.contentItems)
        .values(values)
        .onConflictDoUpdate({ target: s.contentItems.slug, set: values })
        .returning();
      return contentDTO(row);
    },
  );
}

export async function deleteContent(actor: s.UserRow, id: string) {
  invariant(actor.admin, "FORBIDDEN", "Administrator access required.", 403);
  return applyWrite(actor.id, "content.delete", id, async (tx) => {
    await tx.delete(s.contentItems).where(eq(s.contentItems.id, id));
    return { ok: true };
  });
}

const demoContent: ContentInput[] = [
  {
    slug: "golden-gai-first-visit-guide",
    kind: "story",
    section: "travel",
    title: "A first visit to Golden Gai",
    summary:
      "How to actually get into the six-seat bars of Shinjuku's Golden Gai without misstepping.",
    body: "Golden Gai is six alleys of tiny bars behind Kabukicho. Rules that work: pick a bar with a lit sign and an open door, check the cover charge before sitting, and expect to talk to the bartender. Members consistently recommend going with one person, not a group. The best nights are weekdays after ten.",
    sourceUrl: "https://www.google.com/maps/",
    city: "tokyo",
    tags: ["Nightlife", "Shinjuku", "Guides"],
    status: "published",
    featuredRank: 1,
  },
  {
    slug: "one-day-shimokitazawa-guide",
    kind: "story",
    section: "travel",
    title: "One day in Shimokitazawa",
    summary:
      "A walking plan for Tokyo's best neighborhood for vintage, coffee, and small theaters.",
    body: "Shimokitazawa is twenty minutes from Shibuya and it rewards wandering. Start at the south exit coffee shops, browse the vintage arcades around the station, and end with a play at the Suzunari theater or a drink in the back lanes. Sundays are busiest.",
    sourceUrl: "https://www.google.com/maps/",
    city: "tokyo",
    tags: ["Guides", "Coffee", "Setagaya"],
    status: "published",
    featuredRank: 2,
  },
  {
    slug: "team-lab-borders-tokyo",
    kind: "story",
    section: "art",
    title: "TeamLab Borderless reopens in Azabudai Hills",
    summary:
      "The digital art museum returns with larger rooms and new interactive works. A reliable half-day plan for members.",
    body: "TeamLab Borderless moved from Odaiba to Azabudai Hills in 2024 and doubled its floor space. The Athletics Forest and the Light Sculpture rooms are the two most reliable first visits. Buy tickets online for a weekday morning slot; weekend afternoons sell out days ahead. Members often pair it with the nearby Hilltop Garden walk.",
    sourceUrl: "https://www.teamlab.art/e/borderless-azabudai/",
    city: "tokyo",
    tags: ["Exhibitions", "Museums", "Azabudai"],
    status: "published",
    featuredRank: 1,
  },
  {
    slug: "hara-museum-review",
    kind: "story",
    section: "art",
    title: "Hara Museum of Contemporary Art, Shinagawa",
    summary:
      "A converted 1930s residence holding contemporary shows a short walk from Shinagawa station.",
    body: "The Hara Museum sits in a former private residence and shows contemporary Japanese and international artists in a domestic setting. The space is small; an hour is enough. Check the current exhibition before going, since the building sometimes closes between shows.",
    sourceUrl: "https://www.haramuseum.or.jp/",
    city: "tokyo",
    tags: ["Exhibitions", "Museums", "Shinagawa"],
    status: "published",
    featuredRank: 2,
  },
  {
    slug: "tokyo-design-week-preview",
    kind: "story",
    section: "art",
    title: "Tokyo Design Week: what to actually see",
    summary:
      "A short guide to navigating the design week exhibitions without exhausting your afternoon.",
    body: "Design Week spreads across several venues. Pick two: the main exhibition hall for installations and one satellite venue for studio open houses. Student shows are the most consistently interesting part.",
    sourceUrl: "https://tokyodesignweek.ken-okabe.com/",
    city: "tokyo",
    tags: ["Design", "Festivals"],
    status: "published",
    featuredRank: null,
  },
  {
    slug: "tokyo-vinyl-evening-playlist",
    kind: "playlist",
    section: "music",
    title: "An Evening in Tokyo: vinyl-era city pop",
    summary:
      "A starter city pop playlist for late nights, from Tatsuro Yamashita to Mariya Takeuchi.",
    body: "City pop is the sound of 1970s and 80s Tokyo nightlife. Start with Tatsuro Yamashita's For You, then Mariya Takeuchi's Variety, then Maki Nomiya's early work. Many Tokyo listening bars play exactly this set; knowing it makes the room familiar.",
    sourceUrl: "https://open.spotify.com/",
    city: "tokyo",
    tags: ["City Pop", "Vinyl", "Playlists"],
    status: "published",
    featuredRank: 1,
  },
  {
    slug: "blue-note-tokyo-guide",
    kind: "story",
    section: "music",
    title: "Seeing a show at Blue Note Tokyo",
    summary: "How the seating, sets, and ticketing at Tokyo's main jazz club actually work.",
    body: "Blue Note Tokyo runs two sets a night. The first set is easier to book; the second is looser and often better. Seating is assigned, and the room is smaller than photos suggest. Book through the official site, and go on a weeknight.",
    sourceUrl: "https://www.bluenote.co.jp/jp/",
    city: "tokyo",
    tags: ["Jazz", "Live", "Minato"],
    status: "published",
    featuredRank: 2,
  },
  {
    slug: "shibuya-club-circuit-playlist",
    kind: "playlist",
    section: "music",
    title: "Shibuya club circuit: a techno primer",
    summary: "A playlist matching the current Shibuya and Shinjuku club sound.",
    body: "The current Tokyo club sound leans minimal and fast. This primer tracks what Womb, Contact, and Vision residents have been playing recently.",
    sourceUrl: "https://open.spotify.com/",
    city: "tokyo",
    tags: ["Techno", "Clubs", "Playlists"],
    status: "published",
    featuredRank: null,
  },
  {
    slug: "tokyo-dev-meetup-guide",
    kind: "story",
    section: "tech",
    title: "A short guide to Tokyo developer meetups",
    summary:
      "Where the English-friendly engineering meetups actually happen, and how to show up well.",
    body: "Most English-language engineering meetups in Tokyo run on weekday evenings in Shibuya or Marunouchi. RSVP in advance; venue capacity is real. The afterparty matters more than the talks.",
    sourceUrl: "https://www.meetup.com/",
    city: "tokyo",
    tags: ["Engineering", "Meetups"],
    status: "published",
    featuredRank: 1,
  },
  {
    slug: "sample-company-profile",
    kind: "company",
    section: "tech",
    title: "Sample company profile",
    summary: "A template entry. Replace it with a real featured company from the admin console.",
    body: "This is a sample company feature so the Companies list is never empty. Edit it in Admin, Content: set the name, industry, location, website, and an optional confirmed member affiliation.",
    sourceUrl: "https://example.com/",
    city: "tokyo",
    tags: ["Sample"],
    status: "published",
    featuredRank: null,
  },
  {
    slug: "hackathon-teammate-tokyo",
    kind: "opportunity",
    section: "tech",
    title: "Find a teammate for Tokyo hackathons",
    summary:
      "A standing thread for members looking for teammates at Tokyo hackathons and game jams.",
    body: "Use this thread to post what you are building and what you need. Send a direct connection request through the Network. The operator reviews submissions.",
    sourceUrl: "https://ethglobal.com/",
    city: "tokyo",
    tags: ["Hackathons", "Collaboration"],
    status: "published",
    featuredRank: null,
  },
];

export async function seedDemoContent(db: Awaited<ReturnType<typeof getDb>>) {
  for (const item of demoContent) {
    const values = { ...item, publishedAt: new Date(), updatedAt: new Date(), fixture: true };
    await db.insert(s.contentItems).values(values).onConflictDoNothing();
  }
  return demoContent.length;
}
