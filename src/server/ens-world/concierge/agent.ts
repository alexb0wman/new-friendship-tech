import { z } from "zod";
import * as s from "@/server/db/schema";
import { invariant } from "@/server/errors";
import { uuid } from "@/server/config";
import { requireTripAccess } from "@/server/membership";
import { createNowIn, respondRequestIn } from "@/server/social";
import { enqueueEnsJob } from "@/server/ens-v2/jobs";
import { registerApprovalExecutor, requestApproval } from "@/server/world/approvals";
import { INTENTS } from "@/lib/constants";
import { activeTripFor, myTrip } from "../trips";
import { brain } from "./brain";
import { openTables, pendingIntroductions, whoIsAround } from "./tools";
import type { ApprovalDTO } from "@/lib/types";

export const chatSchema = z
  .object({
    city: z
      .string()
      .regex(/^[a-z-]+$/)
      .default("tokyo"),
    message: z.string().trim().min(1).max(500),
  })
  .strict();
export const nowSchema = z
  .object({
    city: z
      .string()
      .regex(/^[a-z-]+$/)
      .default("tokyo"),
    kind: z.enum(INTENTS),
    area: z.string().trim().min(1).max(60),
    until: z.iso.datetime({ offset: true }),
  })
  .strict();
const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
/** One conversational turn: read-only context in, reply plus approvals out. Nothing executes here. */
export async function turn(user: s.UserRow, body: z.infer<typeof chatSchema>) {
  await requireTripAccess(user.id);
  const context = {
    openTables: await openTables(body.city),
    whoIsAround: await whoIsAround(body.city),
    myTrip: await myTrip(user, body.city),
    pendingRequests: await pendingIntroductions(user.id),
  };
  const output = await (
    await brain()
  ).respond({
    user: { id: user.id, name: user.name, neighborhood: user.neighborhood },
    city: body.city,
    message: body.message,
    context,
  });
  const needsLink = output.proposals.length > 0 && !user.worldAgentSub;
  const approvals: ApprovalDTO[] = [];
  if (!needsLink)
    for (const proposal of output.proposals)
      approvals.push(
        await requestApproval(user, {
          action: proposal.action,
          payload: proposal.payload,
          summary: proposal.summary,
        }),
      );
  return {
    reply: needsLink
      ? output.reply + " First, let the concierge act for you from Settings."
      : output.reply,
    approvals,
    needsLink,
  };
}
/** "Ask the concierge to post it": a Right now invitation becomes an approval, then a record on the trip name. */
export async function publishNow(
  user: s.UserRow,
  body: z.infer<typeof nowSchema>,
): Promise<ApprovalDTO> {
  await requireTripAccess(user.id);
  invariant(
    await activeTripFor(user.id, body.city),
    "TRIP_REQUIRED",
    "Activate a trip first.",
    403,
  );
  invariant(user.visible, "PROFILE_PRIVATE", "Make your profile discoverable before posting.", 409);
  return requestApproval(user, {
    action: "now.publish",
    payload: body,
    summary: `Post that you're free for ${body.kind.toLowerCase()} in ${body.area} until ${timeLabel(body.until)}`,
  });
}
registerApprovalExecutor("now.publish", async (tx, approval, user) => {
  const payload = nowSchema.parse(approval.payload);
  const trip = await activeTripFor(user.id, payload.city, tx);
  invariant(trip, "TRIP_REQUIRED", "Activate a trip first.", 403);
  const until = new Date(payload.until);
  const hours = Math.min(6, Math.max(1, Math.ceil((until.getTime() - Date.now()) / 3600000)));
  const post = await createNowIn(tx, user.id, {
    kind: payload.kind,
    neighborhood: payload.area,
    city: payload.city,
    note: `Free for ${payload.kind.toLowerCase()} in ${payload.area} until ${timeLabel(payload.until)}`,
    hours,
  });
  await enqueueEnsJob(tx, {
    kind: "record.set",
    signer: "concierge",
    entityId: trip.id,
    payload: {
      record: {
        type: "text",
        key: "friendship.now",
        value: JSON.stringify({
          kind: payload.kind,
          area: payload.area,
          until: post.expiresAt.toISOString(),
        }),
      },
      store: "nowTx",
    },
  });
  return post.id;
});
registerApprovalExecutor("contact.reveal", async (tx, approval, user) => {
  const payload = z.object({ requestId: uuid }).parse(approval.payload);
  await respondRequestIn(tx, user.id, payload.requestId, "accept");
  return payload.requestId;
});
