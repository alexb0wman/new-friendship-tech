import { keccak256, toHex } from "viem";
import { normalize, packetToBytes } from "viem/ens";
import { z } from "zod";
import { parentName } from "./addresses";
import type { GatheringKind } from "@/lib/types";

/** Trip labels: ENSIP-15 normalised, lower-case alphanumerics and inner hyphens, 3 to 32 characters. */
export const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
export const labelSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .transform((value, ctx) => {
    let normalised = "";
    try {
      normalised = normalize(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Use letters, numbers and hyphens only." });
      return z.NEVER;
    }
    if (!LABEL_PATTERN.test(normalised)) {
      ctx.addIssue({
        code: "custom",
        message: "Labels are 3 to 32 lower-case letters, numbers or inner hyphens.",
      });
      return z.NEVER;
    }
    return normalised;
  });
/** A label suggestion from a display name; the member can edit it before activation. */
export function suggestLabel(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0] ?? "";
  let label = "";
  try {
    label = normalize(first);
  } catch {
    label = "";
  }
  label = label
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return LABEL_PATTERN.test(label) ? label : "friend";
}
export const tripName = (city: string, label: string) => `${label}.${city}.${parentName()}`;
export const tablesAnchor = (city: string) => `tables.${city}.${parentName()}`;
export const tableName = (city: string, label: string) => `${label}.${tablesAnchor(city)}`;
export const conciergeName = (city?: string) =>
  city ? `concierge.${city}.${parentName()}` : `concierge.${parentName()}`;
/** Table label: `<kind>-<MMDD>-<HHmm>` in Tokyo time, plus an optional collision suffix. */
export function tableLabel(kind: GatheringKind, startsAt: Date, suffix?: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Tokyo",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(startsAt)
      .map((part) => [part.type, part.value]),
  );
  return (
    `${kind}-${parts.month}${parts.day}-${parts.hour}${parts.minute}` + (suffix ? "-" + suffix : "")
  );
}
/** DNS wire format of a name, what the Permissioned Resolver setters take. */
export const dnsName = (name: string): `0x${string}` => toHex(packetToBytes(name));
/** The registry identifier of a label: keccak256 of its bytes, as a uint256. */
export const labelId = (label: string): bigint => BigInt(keccak256(toHex(label)));
/** 2100-01-01T00:00:00Z. Anchors never expire on their own. */
export const FAR_FUTURE_EXPIRY = 4102444800;
/** Records written on every new trip so the name renders in ENS apps before the member personalises it. */
export function defaultTripRecords(origin: string) {
  return {
    avatar: origin + "/art/tokyo.svg",
    url: origin,
    description: "Travelling with New Friendship Tech",
  };
}
/** ENSIP-26 agent-context for the concierge name. */
export function conciergeContext(origin: string): string {
  const parent = parentName();
  return [
    "# New Friendship Tech concierge",
    "",
    "I am the concierge for members travelling with New Friendship Tech. Every member trip is a",
    `name under a city namespace (for example maya.tokyo.${parent}) that expires on their departure`,
    `date. Small meals are data-only names under tables.<city>.${parent} whose friendship.table record`,
    "lists the attendees by name.",
    "",
    "What I may write, and nothing else: the text records friendship.now and friendship.table on the",
    "app resolver. Every write that puts a member in a room with someone is approved first by that",
    "member through World ID for Agents.",
    "",
    "How to reach me: the agent-endpoint[mcp] record points at a read-only MCP server with the tools",
    "resolveTrip, openTables and whoIsAround. agent-endpoint[web] is the member app.",
    "",
    `Web: ${origin}/concierge`,
  ].join("\n");
}
