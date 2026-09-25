import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import * as s from "@/server/db/schema";
import { publishedCity } from "@/server/catalog";
import { listGatherings } from "../gatherings";
import { nowFor, tickEnsWorld, tripByName } from "../trips";
import type { GatheringSummary, NowRecord } from "@/lib/types";

/**
 * The concierge's read-only view of a city. Every result is names and public presence; no account
 * ids, wallets or contacts ever pass through here. Shared by the agent loop and the MCP server.
 */
export async function openTables(city: string): Promise<GatheringSummary[]> {
  return listGatherings(null, city);
}
export async function whoIsAround(city: string): Promise<{ name: string; now: NowRecord }[]> {
  await publishedCity(city);
  await tickEnsWorld();
  const db = await getDb();
  const rows = await db
    .select({ userId: s.trips.userId, name: s.trips.ensName })
    .from(s.trips)
    .innerJoin(s.users, eq(s.trips.userId, s.users.id))
    .where(
      and(
        eq(s.trips.city, city),
        eq(s.trips.status, "active"),
        eq(s.users.visible, true),
        eq(s.users.suspended, false),
      ),
    )
    .limit(100);
  const nows = await nowFor(rows.map((row) => row.userId));
  return rows
    .filter((row) => nows.has(row.userId))
    .map((row) => ({ name: row.name, now: nows.get(row.userId)! }));
}
export async function resolveTrip(name: string) {
  return tripByName(name);
}
export async function pendingIntroductions(userId: string) {
  const db = await getDb();
  const rows = await db
    .select({ id: s.connectionRequests.id, senderId: s.connectionRequests.senderId })
    .from(s.connectionRequests)
    .where(
      and(eq(s.connectionRequests.recipientId, userId), eq(s.connectionRequests.status, "pending")),
    )
    .limit(20);
  if (!rows.length) return [];
  const senders = await db
    .select({ id: s.users.id, name: s.users.name })
    .from(s.users)
    .where(
      inArray(
        s.users.id,
        rows.map((row) => row.senderId),
      ),
    );
  return rows.map((row) => ({
    id: row.id,
    from: senders.find((sender) => sender.id === row.senderId)?.name ?? "a member",
  }));
}
export const TOOL_DEFINITIONS = [
  {
    name: "resolveTrip",
    description:
      "Whether a trip name (for example maya.tokyo.<parent>) belongs to a verified human currently present, and what they are open to right now. Returns nothing about the account.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Full ENS trip name" } },
      required: ["name"],
    },
  },
  {
    name: "openTables",
    description:
      "Open tables (coffee, breakfast, lunch, dinner, drinks) in a city with host name, place, time and seats left.",
    inputSchema: {
      type: "object",
      properties: { city: { type: "string", description: "City slug, for example tokyo" } },
      required: ["city"],
    },
  },
  {
    name: "whoIsAround",
    description: "Trip names of verified humans who published a Right now invitation in a city.",
    inputSchema: {
      type: "object",
      properties: { city: { type: "string", description: "City slug, for example tokyo" } },
      required: ["city"],
    },
  },
] as const;
