import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Category, InvoiceStatus, RequestStatus } from "@/lib/types";

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
export const saves = pgTable(
  "saves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: uuid("place_id").references(() => places.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("saves_place_unique").on(t.userId, t.placeId),
    uniqueIndex("saves_event_unique").on(t.userId, t.eventId),
    check("saves_one_target", sql.raw("(place_id IS NULL) <> (event_id IS NULL)")),
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
