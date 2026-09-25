import { AppError } from "@/server/errors";
import { INTENTS } from "@/lib/constants";
import type { ApprovalAction, GatheringSummary, NowRecord, TripDTO } from "@/lib/types";

/**
 * The concierge brain is a pure function from a member's message plus a read-only context to a
 * reply and zero or more proposals. A proposal never executes by itself: the agent turns it into
 * an approval the member answers with a fresh World ID authentication. Swap the brain for a
 * model-backed one by implementing this interface; the plumbing does not change.
 */
export interface Proposal {
  action: ApprovalAction;
  payload: Record<string, unknown>;
  summary: string;
}
export interface BrainInput {
  user: { id: string; name: string; neighborhood: string };
  city: string;
  message: string;
  context: {
    openTables: GatheringSummary[];
    whoIsAround: { name: string; now: NowRecord }[];
    myTrip: TripDTO | null;
    pendingRequests: { id: string; from: string }[];
  };
}
export interface BrainOutput {
  reply: string;
  proposals: Proposal[];
}
export interface ConciergeBrain {
  readonly name: string;
  respond(input: BrainInput): Promise<BrainOutput>;
}
export const CANNED_PROMPTS = [
  "who's around tonight",
  "find me a dinner",
  "post that I'm free for coffee until 18:00",
] as const;
const KIND_WORDS: [RegExp, (typeof INTENTS)[number]][] = [
  [/coffee|cafe|café/i, "Coffee"],
  [/lunch|dinner|breakfast|eat|food|ramen/i, "Food"],
  [/drinks?|bar|beer|sake|wine/i, "Drinks"],
  [/work|cowork|build/i, "Work"],
  [/walk|stroll|run/i, "Walk"],
  [/event|show|gig/i, "Event"],
  [/business|meeting/i, "Business"],
];
const TABLE_WORDS: [RegExp, GatheringSummary["kind"]][] = [
  [/breakfast/i, "breakfast"],
  [/lunch/i, "lunch"],
  [/dinner|ramen|eat/i, "dinner"],
  [/drinks?|bar/i, "drinks"],
  [/coffee|cafe|café/i, "coffee"],
];
const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
/** Today at HH:MM Tokyo time, or tomorrow if that already passed. */
export function tokyoTimeToday(hour: number, minute: number, now = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const pad = (value: number) => String(value).padStart(2, "0");
  let candidate = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${pad(hour)}:${pad(minute)}:00+09:00`,
  );
  if (candidate.getTime() <= now.getTime()) candidate = new Date(candidate.getTime() + 86400000);
  return candidate;
}
export class RuleBrain implements ConciergeBrain {
  readonly name = "rules";
  async respond(input: BrainInput): Promise<BrainOutput> {
    const message = input.message.trim(),
      { context } = input;
    if (
      /who(?:'?s|\s+is)?\s+(around|here|about)|around tonight|anyone (around|here)/i.test(message)
    ) {
      const people = context.whoIsAround.map(
        (item) =>
          `${item.name} is up for ${item.now.kind.toLowerCase()} in ${item.now.area} until ${timeLabel(item.now.until)}`,
      );
      const tables = context.openTables
        .filter((table) => table.seatsLeft > 0)
        .map(
          (table) =>
            `${table.host.name} hosts ${table.kind} ${table.place ? "at " + table.place.name : "in " + table.area} at ${timeLabel(table.startsAt)} (${table.seatsLeft} seats left)`,
        );
      const lines = [...people, ...tables];
      return {
        reply: lines.length
          ? "Around right now:\n" + lines.map((line) => "- " + line).join("\n")
          : "Quiet for now. Host a table or post what you're up for and I'll tell people.",
        proposals: [],
      };
    }
    const wantTable = message.match(/find|any|looking for|want|join|is there/i);
    if (wantTable) {
      const kind = TABLE_WORDS.find(([pattern]) => pattern.test(message))?.[1];
      const candidates = context.openTables.filter(
        (table) =>
          table.seatsLeft > 0 &&
          !table.mine &&
          table.myStatus === null &&
          (!kind || table.kind === kind),
      );
      const table = candidates[0];
      if (!table)
        return {
          reply: kind
            ? `No open ${kind} table right now. Host one from Tables and I'll point people to it.`
            : "No open tables right now. Host one from Tables and I'll point people to it.",
          proposals: [],
        };
      return {
        reply: `${table.host.name} hosts ${table.kind} ${table.place ? "at " + table.place.name : "in " + table.area} at ${timeLabel(table.startsAt)} with ${table.seatsLeft} seats left. Want me to ask for a seat? You approve it in World ID first.`,
        proposals: [
          {
            action: "table.request",
            payload: { gatheringId: table.id, plusOnes: 0 },
            summary: `Ask to join ${table.host.displayName}'s ${table.kind} at ${timeLabel(table.startsAt)}`,
          },
        ],
      };
    }
    const until = message.match(/until\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (/post|free|available|open to/i.test(message) && until) {
      let hour = Number(until[1]);
      const minute = Number(until[2] ?? 0);
      if (until[3]?.toLowerCase() === "pm" && hour < 12) hour += 12;
      if (until[3]?.toLowerCase() === "am" && hour === 12) hour = 0;
      if (hour > 23 || minute > 59)
        return {
          reply: "I did not catch the time. Try: post that I'm free for coffee until 18:00",
          proposals: [],
        };
      const kind = KIND_WORDS.find(([pattern]) => pattern.test(message))?.[1] ?? "Coffee";
      if (!context.myTrip)
        return { reply: "Activate your trip first, then I can post where you are.", proposals: [] };
      const untilDate = tokyoTimeToday(hour, minute);
      return {
        reply: `I'll post that you're free for ${kind.toLowerCase()} in ${input.user.neighborhood} until ${timeLabel(untilDate.toISOString())}. Approve it in World ID and it goes on your name.`,
        proposals: [
          {
            action: "now.publish",
            payload: {
              city: input.city,
              kind,
              area: input.user.neighborhood,
              until: untilDate.toISOString(),
            },
            summary: `Post that you're free for ${kind.toLowerCase()} in ${input.user.neighborhood} until ${timeLabel(untilDate.toISOString())}`,
          },
        ],
      };
    }
    if (/accept.*(request|intro|invitation)|introductions?/i.test(message)) {
      if (!context.pendingRequests.length)
        return { reply: "No pending introductions right now.", proposals: [] };
      return {
        reply: `You have ${context.pendingRequests.length} pending introduction${context.pendingRequests.length > 1 ? "s" : ""}. Accepting reveals your contact, so each one needs your approval.`,
        proposals: context.pendingRequests.map((request) => ({
          action: "contact.reveal",
          payload: { requestId: request.id },
          summary: `Accept the introduction from ${request.from} and share your contact`,
        })),
      };
    }
    return {
      reply:
        "I can tell you who's around, find you a table, or post what you're up for. Try: " +
        CANNED_PROMPTS.map((prompt) => `"${prompt}"`).join(", ") +
        ". Anything that puts you in a room with someone waits for your approval in World ID.",
      proposals: [],
    };
  }
}
let custom: ConciergeBrain | undefined;
/** `CONCIERGE_BRAIN=rules` (default) or `custom`, which loads the owner's model-backed brain. */
export async function brain(): Promise<ConciergeBrain> {
  if ((process.env.CONCIERGE_BRAIN ?? "rules") !== "custom") return new RuleBrain();
  if (custom) return custom;
  try {
    const loaded = (await import("./custom-brain")) as { createBrain?: () => ConciergeBrain };
    custom = loaded.createBrain?.();
  } catch {
    custom = undefined;
  }
  if (!custom)
    throw new AppError(
      "CONCIERGE_UNAVAILABLE",
      "CONCIERGE_BRAIN=custom but src/server/ens-world/concierge/custom-brain.ts exports no createBrain().",
      503,
    );
  return custom;
}
