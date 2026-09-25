import { keccak256, toHex } from "viem";
import type { Database } from "@/server/db";
import * as s from "@/server/db/schema";
import { isDemo } from "@/server/config";
import { eq } from "drizzle-orm";
import { DEMO_IDS } from "@/server/db/seed";
import { chain } from "@/server/ens-v2/chain";
import { ETH_COIN_TYPE } from "@/server/ens-v2/addresses";
import {
  defaultTripRecords,
  labelId,
  tableLabel,
  tableName,
  tripName,
} from "@/server/ens-v2/names";
import { tableRecord } from "./gatherings";

/**
 * Demo fixtures for the ENSv2 + World features: Kenji arrives with an active trip, a linked
 * concierge and a dinner tonight. Maya and Ari start without trips: Maya activates from scratch,
 * Ari first tries Maya's World ID (rejected: one human, one trip) and then activates as herself. Rows are written with the boot-time database handle (never getDb(),
 * which would wait on the very initialisation this runs inside) and the simulated chain gets the
 * matching names and records so every fixture resolves.
 */
const HUMAN = (id: string) => "human-" + id.slice(0, 6);
const SUB = (id: string) => "sim:user-" + id.slice(0, 8);
export async function seedEnsWorldDemo(db: Database) {
  if (!isDemo()) throw new Error("ENS world fixtures are local-demo only");
  if (process.env.NFT_SKIP_ENS_SEED === "true") return;
  const c = chain();
  const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  const now = Date.now();
  async function seedTrip(userId: string, label: string, wallet: string) {
    const departsAt = new Date(now + 3 * 86400000),
      arrivesAt = new Date(now - 6 * 3600000);
    const nullifier = BigInt(keccak256(toHex("sim:" + HUMAN(userId)))).toString();
    const [proof] = await db
      .insert(s.humanProofs)
      .values({
        userId,
        action: "trip-activate",
        city: "tokyo",
        nullifier,
        signalHash: keccak256(toHex("tokyo")),
        issuerSchemaId: "simulated",
        environment: "simulated",
      })
      .returning();
    const name = tripName("tokyo", label);
    const registered = await c.registerTrip({
      city: "tokyo",
      label,
      owner: wallet,
      expiry: Math.floor(departsAt.getTime() / 1000),
    });
    const defaults = defaultTripRecords(origin);
    const records = await c.setRecords("operator", name, [
      { type: "addr", coinType: ETH_COIN_TYPE, address: wallet },
      {
        type: "text",
        key: "friendship.trip",
        value: JSON.stringify({
          city: "tokyo",
          arrivesAt: arrivesAt.toISOString(),
          departsAt: departsAt.toISOString(),
          verifiedHuman: true,
        }),
      },
      { type: "text", key: "avatar", value: defaults.avatar },
      { type: "text", key: "url", value: defaults.url },
      { type: "text", key: "description", value: defaults.description },
    ]);
    const [trip] = await db
      .insert(s.trips)
      .values({
        userId,
        city: "tokyo",
        label,
        ensName: name,
        labelhash: "0x" + labelId(label).toString(16).padStart(64, "0"),
        registry: c.addresses.cityRegistry,
        resolver: c.addresses.appResolver,
        arrivesAt,
        departsAt,
        status: "active",
        chainTx: registered.hash,
        recordsTx: records.hash,
        chainVerifiedAt: new Date(),
        humanProofId: proof.id,
      })
      .returning();
    await db
      .update(s.users)
      .set({
        verifiedHumanAt: new Date(),
        worldAgentIssuer: "simulated",
        worldAgentSub: SUB(userId),
      })
      .where(eq(s.users.id, userId));
    return trip;
  }
  const kenji = await seedTrip(DEMO_IDS.kenji, "kenji", "0x" + "3".padStart(40, "0"));
  // Kenji's dinner tonight at a sample venue, six seats, open.
  const [place] = await db
    .select()
    .from(s.places)
    .where(eq(s.places.slug, "sample-table-for-tomorrow"));
  const startsAt = new Date(now + 4 * 3600000);
  const label = tableLabel("dinner", startsAt);
  const [gathering] = await db
    .insert(s.gatherings)
    .values({
      hostUserId: DEMO_IDS.kenji,
      tripId: kenji.id,
      city: "tokyo",
      kind: "dinner",
      placeId: place?.id ?? null,
      area: place?.neighborhood ?? "Shibuya",
      startsAt,
      seats: 6,
      label,
      ensName: tableName("tokyo", label),
    })
    .returning();
  await db.insert(s.gatheringAttendees).values({
    gatheringId: gathering.id,
    userId: DEMO_IDS.kenji,
    tripId: kenji.id,
    role: "host",
    plusOnes: 0,
    status: "approved",
  });
  const written = await c.setRecords("concierge", gathering.ensName, [
    { type: "text", key: "friendship.table", value: await tableRecord(gathering.id, db) },
  ]);
  await db
    .update(s.gatherings)
    .set({ chainRecordTx: written.hash, chainVerifiedAt: new Date() })
    .where(eq(s.gatherings.id, gathering.id));
}
