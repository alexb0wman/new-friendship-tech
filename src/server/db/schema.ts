import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  ApprovalAction,
  ApprovalStatus,
  AttendeeStatus,
  Category,
  ContentKind,
  ContentSection,
  ContentStatus,
  EnsJobKind,
  EnsJobSigner,
  GatheringKind,
  GatheringStatus,
  InvoiceStatus,
  RequestStatus,
  TripStatus,
} from "@/lib/types";

const time = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authSubject: text("auth_subject").notNull().unique(),
    name: text("name").notNull(),
    role: text("role").notNull().default("Member"),
    bio: text("bio").notNull().default(""),
    interests: jsonb("interests").$type<string[]>().notNull().default([]),
    intents: jsonb("intents").$type<string[]>().notNull().default([]),
    city: text("city").notNull().default("tokyo"),
    neighborhood: text("neighborhood").notNull().default("Anywhere in Tokyo"),
    visible: boolean("visible").notNull().default(false),
    onboarded: boolean("onboarded").notNull().default(false),
    admin: boolean("admin").notNull().default(false),
    host: boolean("host").notNull().default(false),
    suspended: boolean("suspended").notNull().default(false),
    fixture: boolean("fixture").notNull().default(false),
    verifiedHumanAt: time("verified_human_at"),
    worldAgentIssuer: text("world_agent_issuer"),
    worldAgentSub: text("world_agent_sub"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [index("users_discovery_idx").on(t.city, t.visible, t.suspended)],
);

export const cities = pgTable("cities", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull(),
  published: boolean("published").notNull().default(false),
});
export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    city: text("city")
      .notNull()
      .references(() => cities.slug),
    name: text("name").notNull(),
    neighborhood: text("neighborhood").notNull(),
    category: text("category").$type<Category>().notNull(),
    note: text("note").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    mapUrl: text("map_url").notNull(),
    sourceUrl: text("source_url").notNull(),
    price: text("price"),
    preview: boolean("preview").notNull().default(false),
    published: boolean("published").notNull().default(false),
    fixture: boolean("fixture").notNull().default(false),
    artwork: text("artwork").notNull().default("01"),
    reviewedAt: time("reviewed_at"),
  },
  (t) => [index("places_city_idx").on(t.city, t.published, t.category)],
);
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    city: text("city")
      .notNull()
      .references(() => cities.slug),
    title: text("title").notNull(),
    neighborhood: text("neighborhood").notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    registrationUrl: text("registration_url").notNull(),
    sourceUrl: text("source_url").notNull(),
    accessNote: text("access_note").notNull(),
    published: boolean("published").notNull().default(false),
    fixture: boolean("fixture").notNull().default(false),
  },
  (t) => [
    index("events_city_time_idx").on(t.city, t.startsAt),
    check("events_time_order", sql.raw("ends_at > starts_at")),
  ],
);
export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    kind: text("kind").$type<ContentKind>().notNull(),
    section: text("section").$type<ContentSection>().notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    body: text("body").notNull(),
    sourceUrl: text("source_url").notNull(),
    city: text("city"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    status: text("status").$type<ContentStatus>().notNull().default("draft"),
    featuredRank: integer("featured_rank"),
    fixture: boolean("fixture").notNull().default(false),
    publishedAt: time("published_at").notNull().defaultNow(),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [index("content_items_section_idx").on(t.section, t.status, t.kind)],
);
export const saves = pgTable(
  "saves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: uuid("place_id").references(() => places.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
    contentId: uuid("content_id").references(() => contentItems.id, { onDelete: "cascade" }),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("saves_place_unique").on(t.userId, t.placeId),
    uniqueIndex("saves_event_unique").on(t.userId, t.eventId),
    uniqueIndex("saves_content_unique").on(t.userId, t.contentId),
    check(
      "saves_one_target",
      sql.raw("(place_id IS NULL)::int + (event_id IS NULL)::int + (content_id IS NULL)::int = 2"),
    ),
  ],
);
export const privateContacts = pgTable("private_contacts", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  sealed: jsonb("sealed")
    .$type<{
      ciphertext: string;
      iv: string;
      tag: string;
      wrappedKey: string;
      mode: "kms" | "demo";
    }>()
    .notNull(),
  shareOnAcceptance: boolean("share_on_acceptance").notNull().default(false),
  updatedAt: time("updated_at").notNull().defaultNow(),
});
export const walletLinks = pgTable("wallet_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  address: text("address").notNull().unique(),
  verifiedAt: time("verified_at").notNull().defaultNow(),
});
export const ensIdentities = pgTable(
  "ens_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    chainId: integer("chain_id").notNull(),
    nameHash: text("name_hash").notNull(),
    address: text("address").notNull(),
    resolver: text("resolver"),
    verifiedAt: time("verified_at").notNull(),
    stale: boolean("stale").notNull().default(false),
  },
  (t) => [
    uniqueIndex("ens_name_chain_unique").on(t.chainId, t.name),
    uniqueIndex("ens_user_chain_unique").on(t.userId, t.chainId),
  ],
);
export const nowPosts = pgTable(
  "now_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    city: text("city")
      .notNull()
      .references(() => cities.slug),
    neighborhood: text("neighborhood").notNull(),
    kind: text("kind").notNull(),
    note: text("note").notNull(),
    placeId: uuid("place_id").references(() => places.id, { onDelete: "set null" }),
    startsAt: time("starts_at").notNull(),
    expiresAt: time("expires_at").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("now_discovery_idx").on(t.city, t.active, t.expiresAt),
    uniqueIndex("now_one_active").on(t.userId).where(sql.raw("active = true")),
    check("now_time_order", sql.raw("expires_at > starts_at")),
  ],
);
export const connectionRequests = pgTable(
  "connection_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    context: text("context").notNull(),
    status: text("status").$type<RequestStatus>().notNull().default("pending"),
    nowPostId: uuid("now_post_id").references(() => nowPosts.id, { onDelete: "set null" }),
    idempotencyKey: text("idempotency_key").notNull(),
    entitlementId: uuid("entitlement_id"),
    createdAt: time("created_at").notNull().defaultNow(),
    expiresAt: time("expires_at").notNull(),
  },
  (t) => [
    uniqueIndex("requests_sender_idempotency").on(t.senderId, t.idempotencyKey),
    index("requests_recipient_status").on(t.recipientId, t.status),
    check("request_not_self", sql.raw("sender_id <> recipient_id")),
  ],
);
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lowUserId: uuid("low_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    highUserId: uuid("high_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    acceptedAt: time("accepted_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("connections_pair_unique").on(t.lowUserId, t.highUserId),
    check("connections_order", sql.raw("low_user_id < high_user_id")),
  ],
);
export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("blocks_pair_unique").on(t.actorId, t.targetId),
    check("block_not_self", sql.raw("actor_id <> target_id")),
  ],
);
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  targetId: uuid("target_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    idempotencyKey: text("idempotency_key").notNull(),
    planVersion: integer("plan_version").notNull(),
    usdCents: integer("usd_cents").notNull(),
    provider: text("provider").notNull(),
    status: text("status").$type<InvoiceStatus>().notNull().default("quoted"),
    quote: jsonb("quote")
      .$type<{
        chainId: number;
        asset: string;
        recipient: string;
        amount: string;
        sourceWallet: string;
        providerQuoteId: string;
      }>()
      .notNull(),
    quoteExpiresAt: time("quote_expires_at").notNull(),
    sourceTx: text("source_tx"),
    destinationTx: text("destination_tx"),
    providerOrderId: text("provider_order_id"),
    settledAt: time("settled_at"),
    failureCode: text("failure_code"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invoice_user_idempotency").on(t.userId, t.idempotencyKey),
    uniqueIndex("invoice_source_tx_unique").on(t.sourceTx),
    index("invoices_user_idx").on(t.userId, t.createdAt),
  ],
);
export const settlements = pgTable("payment_settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id)
    .unique(),
  settlementKey: text("settlement_key").notNull().unique(),
  chainId: integer("chain_id").notNull(),
  txHash: text("tx_hash").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    invoiceId: uuid("invoice_id")
      .references(() => invoices.id)
      .unique(),
    planKey: text("plan_key").notNull().default("all_access_30d"),
    source: text("source").notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
  },
  (t) => [
    index("entitlements_user_time").on(t.userId, t.startsAt, t.endsAt),
    check("entitlements_positive_period", sql.raw("ends_at > starts_at")),
  ],
);
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id)
      .unique(),
    status: text("status").notNull().default("ready"),
    attempts: integer("attempts").notNull().default(0),
    runAfter: time("run_after").notNull().defaultNow(),
    leaseUntil: time("lease_until"),
    leaseOwner: text("lease_owner"),
    lastError: text("last_error"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("jobs_due_idx").on(t.status, t.runAfter)],
);
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetsAt: time("resets_at").notNull(),
});
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  entityId: text("entity_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
});
export type UserRow = typeof users.$inferSelect;

export const ensWriteIntents = pgTable(
  "ens_write_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    wallet: text("wallet").notNull(),
    resolver: text("resolver").notNull(),
    chainId: integer("chain_id").notNull(),
    calldata: text("calldata").notNull(),
    description: text("description").notNull(),
    expiresAt: time("expires_at").notNull(),
    txHash: text("tx_hash").unique(),
    confirmedAt: time("confirmed_at"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("ens_intents_user_idx").on(t.userId, t.expiresAt)],
);

// ENSv2 trips, tables, World ID proofs, agent approvals and chain jobs (drizzle/0003).
export const humanProofs = pgTable(
  "human_proofs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    city: text("city").notNull(),
    nullifier: numeric("nullifier", { precision: 78, scale: 0 }).notNull(),
    signalHash: text("signal_hash"),
    issuerSchemaId: text("issuer_schema_id"),
    expiresAtMin: time("expires_at_min"),
    environment: text("environment").notNull(),
    verifiedAt: time("verified_at").notNull().defaultNow(),
  },
  (t) => [index("human_proofs_lookup_idx").on(t.action, t.city, t.nullifier)],
);
export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    city: text("city")
      .notNull()
      .references(() => cities.slug),
    label: text("label").notNull(),
    ensName: text("ens_name").notNull(),
    labelhash: text("labelhash").notNull(),
    registry: text("registry").notNull(),
    resolver: text("resolver").notNull(),
    arrivesAt: time("arrives_at").notNull(),
    departsAt: time("departs_at").notNull(),
    status: text("status").$type<TripStatus>().notNull().default("pending_chain"),
    chainTx: text("chain_tx"),
    recordsTx: text("records_tx"),
    chainVerifiedAt: time("chain_verified_at"),
    humanProofId: uuid("human_proof_id").references(() => humanProofs.id, {
      onDelete: "set null",
    }),
    nowTx: text("now_tx"),
    payAddress: text("pay_address"),
    payTx: text("pay_tx"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("trips_active_label_unique")
      .on(t.city, t.label)
      .where(sql.raw("status IN ('pending_chain','active')")),
    uniqueIndex("trips_active_user_unique")
      .on(t.userId, t.city)
      .where(sql.raw("status IN ('pending_chain','active')")),
    index("trips_city_status_idx").on(t.city, t.status, t.departsAt),
    check("trips_time_order", sql.raw("departs_at > arrives_at")),
  ],
);
export const gatherings = pgTable(
  "gatherings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    city: text("city")
      .notNull()
      .references(() => cities.slug),
    kind: text("kind").$type<GatheringKind>().notNull(),
    placeId: uuid("place_id").references(() => places.id, { onDelete: "set null" }),
    area: text("area").notNull(),
    startsAt: time("starts_at").notNull(),
    seats: integer("seats").notNull(),
    label: text("label").notNull(),
    ensName: text("ens_name").notNull(),
    status: text("status").$type<GatheringStatus>().notNull().default("open"),
    splitStatus: text("split_status")
      .$type<"none" | "pending" | "settled">()
      .notNull()
      .default("none"),
    splitTotalCents: integer("split_total_cents"),
    splitCurrency: text("split_currency"),
    chainRecordTx: text("chain_record_tx"),
    chainVerifiedAt: time("chain_verified_at"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("gatherings_label_unique").on(t.city, t.label),
    index("gatherings_city_status_idx").on(t.city, t.status, t.startsAt),
    check("gatherings_seats_range", sql.raw("seats >= 2 AND seats <= 8")),
  ],
);
export const agentApprovals = pgTable(
  "agent_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").$type<ApprovalAction>().notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    summary: text("summary").notNull(),
    nonce: text("nonce").notNull().unique(),
    codeVerifier: text("code_verifier").notNull(),
    status: text("status").$type<ApprovalStatus>().notNull().default("pending"),
    worldSub: text("world_sub"),
    authTime: time("auth_time"),
    resultId: text("result_id"),
    expiresAt: time("expires_at").notNull(),
    consumedAt: time("consumed_at"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("agent_approvals_user_idx").on(t.userId, t.status, t.createdAt)],
);
export const gatheringAttendees = pgTable(
  "gathering_attendees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gatheringId: uuid("gathering_id")
      .notNull()
      .references(() => gatherings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    role: text("role").$type<"host" | "member">().notNull(),
    plusOnes: integer("plus_ones").notNull().default(0),
    status: text("status").$type<AttendeeStatus>().notNull().default("requested"),
    approvalId: uuid("approval_id").references(() => agentApprovals.id, {
      onDelete: "set null",
    }),
    shareCents: integer("share_cents"),
    payAddress: text("pay_address"),
    paidTx: text("paid_tx"),
    paidVerifiedAt: time("paid_verified_at"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("attendees_gathering_user_unique").on(t.gatheringId, t.userId),
    check("attendees_plus_ones_range", sql.raw("plus_ones >= 0 AND plus_ones <= 1")),
  ],
);
export const ensJobs = pgTable(
  "ens_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<EnsJobKind>().notNull(),
    signer: text("signer").$type<EnsJobSigner>().notNull(),
    entityId: text("entity_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status")
      .$type<"ready" | "running" | "done" | "review">()
      .notNull()
      .default("ready"),
    attempts: integer("attempts").notNull().default(0),
    runAfter: time("run_after").notNull().defaultNow(),
    leaseUntil: time("lease_until"),
    leaseOwner: text("lease_owner"),
    lastError: text("last_error"),
    txHash: text("tx_hash"),
    verifiedAt: time("verified_at"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("ens_jobs_due_idx").on(t.status, t.runAfter)],
);
export type TripRow = typeof trips.$inferSelect;
export type HumanProofRow = typeof humanProofs.$inferSelect;
export type GatheringRow = typeof gatherings.$inferSelect;
export type AttendeeRow = typeof gatheringAttendees.$inferSelect;
export type ApprovalRow = typeof agentApprovals.$inferSelect;
export type EnsJobRow = typeof ensJobs.$inferSelect;
