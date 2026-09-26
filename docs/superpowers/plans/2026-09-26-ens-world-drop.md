# ENSv2 + World Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expiring ENSv2 trip names, data-only table names with on-chain attendee records, a scoped concierge agent, World ID proof-of-human at trip activation and World ID for Agents step-up approvals to `new-friendship-tech`, as a branch that merges cleanly onto `main` at `8c83694`.

**Architecture:** Every new behaviour is a service under `src/server/` behind the existing `applyWrite` audit wrapper, reached through the existing Web Request router. Chain and World access sit behind adapter interfaces with a simulated implementation for demo mode and tests and a live implementation for Sepolia and the World sandbox. Protected actions run only as the executor of a consumed `agent_approvals` row. Chain writes run as leased jobs that end with receipt, re-read and compare.

**Tech Stack:** Next 16.3.6, React 19.3, TypeScript 5.9, Drizzle 0.45 + PGlite (tests, demo) / node-postgres (prod), viem 2.56, zod 4, jose 6, vitest 5, `@worldcoin/idkit` 4.3.0 (+ `idkit-core` signing/hashing).

**Spec:** `docs/ENS-WORLD-SPEC.md` (owner spec) and `docs/ENS-WORLD-DESIGN.md` (decisions and deviations; wins on conflict).

## Global Constraints

- Node `>=22 <25`; every dependency pinned to an exact version in `package.json`.
- No em dashes anywhere (code, comments, docs, copy).
- Do not edit an applied SQL migration; new schema goes in `drizzle/0003_trips_tables_world.sql`, hand-written, no `drizzle/meta` regeneration (repo precedent: `0002`).
- All Access stays global; a trip is not an entitlement.
- `users.id` is the only account identifier. Names and wallets are linked identifiers.
- No contacts in profiles, logs, ENS records or unauthenticated responses. Table records carry ENS names only.
- Demo mode (`APP_MODE=demo`) needs no secrets and must never run in a production process. Simulated adapters are selected by `isDemo()` only.
- Every mutation goes through `applyWrite`. Browser callbacks are hints; the server proves.
- Every chain write: prepare calldata, submit, receipt, fresh re-read, compare, then mark verified.
- Framework conventions: read `node_modules/next/dist/docs/` before writing Next code.
- Prettier formatting (`npm run format:check` must pass); `npm run typecheck`, `npm test`, `npm run build` must pass on the branch.
- Commit after each task with a message that says what works, how it was verified, what remains.

---

## File structure

```
drizzle/0003_trips_tables_world.sql        new tables + users columns          (Task 1)
src/server/db/schema.ts                    Drizzle definitions (append)         (Task 1)
src/server/db/seed.ts                      Kenji + Ari actors, demo trips/tables (Task 1, Task 15)
src/server/router.ts                       actor enum, config keys, public paths, delegate (Task 1, Task 7)
src/lib/types.ts                           Trip/Gathering/Approval DTO types    (Task 1, Task 11)

src/server/ens-v2/abi.ts                   viem ABIs from the Sepolia deployment JSON (Task 2)
src/server/ens-v2/roles.ts                 role bitmaps                          (Task 2)
src/server/ens-v2/names.ts                 labels, names, dnsName, labelId, defaults (Task 2)
src/server/ens-v2/addresses.ts             Sepolia addresses + parent-derived names (Task 2)
src/server/ens-v2/chain.ts                 ChainAdapter interface + selection    (Task 3)
src/server/ens-v2/simulated.ts             SimulatedChain                        (Task 3)
src/server/ens-v2/sepolia.ts               SepoliaChain (viem)                   (Task 3)
src/server/ens-v2/proof.ts                 assertChainWriteProof                 (Task 3)
src/server/ens-v2/jobs.ts                  ens_jobs enqueue, handlers, worker     (Task 4)
src/worker/index.ts                        run ENS worker in the loop (patch)    (Task 4)

src/server/world/adapter.ts                WorldAdapter interface + selection    (Task 5)
src/server/world/simulated.ts              SimulatedWorld                        (Task 5)
src/server/world/live.ts                   WorldLive (IDKit signing/verify, OIDC) (Task 5)
src/server/world/approvals.ts              agent_approvals state machine + executors (Task 6)

src/server/ens-world/trips.ts              trips service                         (Task 7)
src/server/ens-world/router.ts             all new /api routes + isPublicPath     (Task 7+)
src/server/ens-world/dto.ts                DTO builders                          (Task 7)
src/server/ens-world/gatherings.ts         tables service + record JSON          (Task 8)
src/server/ens-world/split.ts              split service                         (Task 9)
src/server/ens-world/concierge/tools.ts    read-only tools                        (Task 10)
src/server/ens-world/concierge/brain.ts    ConciergeBrain + RuleBrain            (Task 10)
src/server/ens-world/concierge/agent.ts    turn(), publishNow executor           (Task 10)
src/server/ens-world/concierge/mcp.ts      JSON-RPC MCP handler                  (Task 10)
src/app/api/mcp/route.ts                   MCP Next route                        (Task 10)

src/components/human-check.tsx             IDKit widget / simulated panel        (Task 11)
src/components/approval-modal.tsx          approval flow + polling                (Task 11)
src/components/views/trip-card.tsx         settings trip card                    (Task 11)
src/components/views/account.tsx           mount TripCard (patch)                (Task 11)
src/server/social.ts                       publicMember extras (patch)           (Task 11)
src/components/views/people.tsx            badges (patch)                        (Task 11)
src/components/views/tables.tsx            tables list + host form               (Task 12)
src/components/views/table-detail.tsx      table detail + split                  (Task 12)
src/components/platform.tsx                routes (patch)                        (Task 12)
src/components/app-shell.tsx               nav + drawer mount (patch)            (Task 12, 13)
src/app/globals.css                        @import ens-world.css (patch)         (Task 12)
src/app/ens-world.css                      new styles                            (Task 12)
src/components/concierge-drawer.tsx        chat drawer                           (Task 13)
src/components/views/now-events.tsx        concierge-posted Right now (patch)    (Task 13)

scripts/ens-bootstrap.ts, scripts/ens-smoke.ts                                   (Task 14)
docs/*, .env.example, README.md, AGENT-MERGE-GUIDE.md, README-INTEGRATION.md     (Task 15)
tests/helpers.ts, tests/ens-world-domain.test.ts, tests/trips.test.ts,
tests/gatherings.test.ts, tests/world.test.ts                                    (Tasks 2-10)
```

Level of detail: interfaces, SQL, ABIs, state machines, route tables and test cases below are binding and complete. Function bodies follow the patterns quoted from the repo (`social.ts`, `payments/service.ts`, `ens.ts`); where a body is not shown, write it in that style.

---

### Task 1: Schema, migration, demo actors, DTO types

**Files:**

- Create: `drizzle/0003_trips_tables_world.sql`
- Modify: `src/server/db/schema.ts` (append after `ensWriteIntents`)
- Modify: `src/server/db/seed.ts` (`DEMO_ACTORS`, member neighborhoods unchanged)
- Modify: `src/server/router.ts:60` (actor enum derived from `DEMO_ACTORS`)
- Modify: `src/lib/types.ts` (append)
- Test: `tests/ens-world-domain.test.ts` (new file, first cases)

**Interfaces:**

- Produces Drizzle tables `trips`, `humanProofs`, `gatherings`, `gatheringAttendees`, `agentApprovals`, `ensJobs`; `users` gains `verifiedHumanAt`, `worldAgentIssuer`, `worldAgentSub`.
- Produces types `TripStatus`, `GatheringKind`, `GatheringStatus`, `AttendeeStatus`, `ApprovalAction`, `ApprovalStatus`, `EnsJobKind`, `EnsJobSigner`, `TripDTO`, `GatheringSummary`, `GatheringDetail`, `ApprovalDTO`.
- `DEMO_IDS` gains nothing; `DEMO_ACTORS` gains `kenji` and `ari`.

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE "users" ADD COLUMN "verified_human_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "world_agent_issuer" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "world_agent_sub" text;--> statement-breakpoint
CREATE TABLE "human_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"city" text NOT NULL,
	"nullifier" numeric(78, 0) NOT NULL,
	"signal_hash" text,
	"issuer_schema_id" text,
	"expires_at_min" timestamp with time zone,
	"environment" text NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"city" text NOT NULL,
	"label" text NOT NULL,
	"ens_name" text NOT NULL,
	"labelhash" text NOT NULL,
	"registry" text NOT NULL,
	"resolver" text NOT NULL,
	"arrives_at" timestamp with time zone NOT NULL,
	"departs_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending_chain' NOT NULL,
	"chain_tx" text,
	"records_tx" text,
	"chain_verified_at" timestamp with time zone,
	"human_proof_id" uuid,
	"now_tx" text,
	"pay_address" text,
	"pay_tx" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_time_order" CHECK (departs_at > arrives_at)
);--> statement-breakpoint
CREATE TABLE "gatherings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_user_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"city" text NOT NULL,
	"kind" text NOT NULL,
	"place_id" uuid,
	"area" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"seats" integer NOT NULL,
	"label" text NOT NULL,
	"ens_name" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"split_status" text DEFAULT 'none' NOT NULL,
	"split_total_cents" integer,
	"split_currency" text,
	"chain_record_tx" text,
	"chain_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gatherings_seats_range" CHECK (seats >= 2 AND seats <= 8)
);--> statement-breakpoint
CREATE TABLE "gathering_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gathering_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"role" text NOT NULL,
	"plus_ones" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"approval_id" uuid,
	"share_cents" integer,
	"pay_address" text,
	"paid_tx" text,
	"paid_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendees_plus_ones_range" CHECK (plus_ones >= 0 AND plus_ones <= 1)
);--> statement-breakpoint
CREATE TABLE "agent_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text NOT NULL,
	"nonce" text NOT NULL,
	"code_verifier" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"world_sub" text,
	"auth_time" timestamp with time zone,
	"result_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_approvals_nonce_unique" UNIQUE("nonce")
);--> statement-breakpoint
CREATE TABLE "ens_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"signer" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"lease_owner" text,
	"last_error" text,
	"tx_hash" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "human_proofs" ADD CONSTRAINT "human_proofs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_city_cities_slug_fk" FOREIGN KEY ("city") REFERENCES "public"."cities"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_human_proof_id_human_proofs_id_fk" FOREIGN KEY ("human_proof_id") REFERENCES "public"."human_proofs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_city_cities_slug_fk" FOREIGN KEY ("city") REFERENCES "public"."cities"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gathering_attendees" ADD CONSTRAINT "gathering_attendees_gathering_id_gatherings_id_fk" FOREIGN KEY ("gathering_id") REFERENCES "public"."gatherings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gathering_attendees" ADD CONSTRAINT "gathering_attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gathering_attendees" ADD CONSTRAINT "gathering_attendees_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gathering_attendees" ADD CONSTRAINT "gathering_attendees_approval_id_agent_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."agent_approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "human_proofs_lookup_idx" ON "human_proofs" USING btree ("action","city","nullifier");--> statement-breakpoint
CREATE UNIQUE INDEX "trips_active_label_unique" ON "trips" USING btree ("city","label") WHERE status IN ('pending_chain','active');--> statement-breakpoint
CREATE UNIQUE INDEX "trips_active_user_unique" ON "trips" USING btree ("user_id","city") WHERE status IN ('pending_chain','active');--> statement-breakpoint
CREATE INDEX "trips_city_status_idx" ON "trips" USING btree ("city","status","departs_at");--> statement-breakpoint
CREATE UNIQUE INDEX "gatherings_label_unique" ON "gatherings" USING btree ("city","label");--> statement-breakpoint
CREATE INDEX "gatherings_city_status_idx" ON "gatherings" USING btree ("city","status","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attendees_gathering_user_unique" ON "gathering_attendees" USING btree ("gathering_id","user_id");--> statement-breakpoint
CREATE INDEX "agent_approvals_user_idx" ON "agent_approvals" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "ens_jobs_due_idx" ON "ens_jobs" USING btree ("status","run_after");
```

- [ ] **Step 2: Append the Drizzle definitions** (same column names, `numeric("nullifier", { precision: 78, scale: 0 })`, partial unique indexes with `.where(sql\`status IN ('pending_chain','active')\`)`, checks with `check(...)`). Add `verifiedHumanAt: time("verified_human_at")`, `worldAgentIssuer: text("world_agent_issuer")`, `worldAgentSub: text("world_agent_sub")`to`users`. Export row types `TripRow`, `GatheringRow`, `AttendeeRow`, `ApprovalRow`, `EnsJobRow`.

- [ ] **Step 3: Types** in `src/lib/types.ts`:

```ts
export type TripStatus = "pending_chain" | "active" | "ended" | "expired" | "failed";
export type GatheringKind = "coffee" | "breakfast" | "lunch" | "dinner" | "drinks";
export type GatheringStatus = "open" | "full" | "closed" | "cancelled";
export type AttendeeStatus = "requested" | "approved" | "declined" | "left";
export type ApprovalAction =
  "agent.link" | "now.publish" | "table.request" | "table.approve" | "contact.reveal";
export type ApprovalStatus = "pending" | "approved" | "denied" | "expired" | "consumed";
export type EnsJobKind =
  "trip.register" | "trip.renew" | "trip.expire" | "record.set" | "table.write" | "split.verify";
export type EnsJobSigner = "operator" | "concierge" | "none";
export interface NowRecord {
  kind: string;
  area: string;
  until: string;
}
export interface TripDTO {
  id: string;
  city: string;
  label: string;
  name: string;
  status: TripStatus;
  arrivesAt: string;
  departsAt: string;
  chainTx: string | null;
  recordsTx: string | null;
  chainVerifiedAt: string | null;
  verifiedHuman: boolean;
  now: NowRecord | null;
  payAddress: string | null;
  explorer: { name: string; tx: string | null };
}
export interface GatheringSummary {
  id: string;
  city: string;
  kind: GatheringKind;
  area: string;
  place: { id: string; slug: string; name: string } | null;
  startsAt: string;
  seats: number;
  seatsLeft: number;
  status: GatheringStatus;
  label: string;
  name: string;
  host: { name: string; displayName: string; verifiedHuman: boolean };
  chainRecordTx: string | null;
  chainVerifiedAt: string | null;
  mine: boolean;
  myStatus: AttendeeStatus | null;
  explorer: { name: string; tx: string | null };
}
export interface AttendeeDTO {
  id: string;
  name: string;
  displayName: string;
  role: "host" | "member";
  plusOnes: number;
  status: AttendeeStatus;
  verifiedHuman: boolean;
  shareCents: number | null;
  paidTx: string | null;
  paidVerifiedAt: string | null;
}
export interface GatheringDetail extends GatheringSummary {
  attendees: AttendeeDTO[];
  guests: number;
  split: {
    status: "none" | "pending" | "settled";
    totalCents: number | null;
    unitCents: number | null;
    hostCents: number | null;
    mine: {
      shareCents: number;
      payTo: string;
      token: string;
      amountBaseUnits: string;
      paidTx: string | null;
      verified: boolean;
    } | null;
  };
  record: string | null;
}
export interface ApprovalDTO {
  id: string;
  action: ApprovalAction;
  summary: string;
  status: ApprovalStatus;
  url: string | null;
  expiresAt: string;
  resultId: string | null;
  simulated: boolean;
}
```

- [ ] **Step 4: Demo actors** in `seed.ts`: add `{ key: "kenji", id: DEMO_IDS.kenji, label: "Kenji · All Access" }` and `{ key: "ari", id: DEMO_IDS.ari, label: "Ari · All Access" }` to `DEMO_ACTORS`. In `router.ts` replace `z.enum(["alex", "maya", "admin"])` with `z.enum(DEMO_ACTORS.map((item) => item.key) as [string, ...string[]])`.

- [ ] **Step 5: Test** (`tests/ens-world-domain.test.ts`): boot `getDb()` and assert the six tables exist via `select table_name from information_schema.tables`, and that `POST /api/demo/session {actor:"kenji"}` returns 200 (reuse the `api()` helper: create `tests/helpers.ts` exporting `api`, `cookies`, `bootSession()` copied from `tests/api.test.ts`).

- [ ] **Step 6: Run** `npm test`, expect the 44 existing tests plus the new ones to pass. **Commit** `feat(db): trips, tables, human proofs, agent approvals and ENS jobs schema`.

---

### Task 2: ENSv2 primitives (ABIs, roles, names, addresses)

**Files:** Create `src/server/ens-v2/abi.ts`, `roles.ts`, `names.ts`, `addresses.ts`. Test: `tests/ens-world-domain.test.ts`.

**Interfaces (produces):**

```ts
// roles.ts (all bigint)
export const REGISTRY = {
  ROLE_REGISTRAR: 1n << 0n,
  ROLE_REGISTER_RESERVED: 1n << 4n,
  ROLE_SET_PARENT: 1n << 8n,
  ROLE_UNREGISTER: 1n << 12n,
  ROLE_RENEW: 1n << 16n,
  ROLE_SET_SUBREGISTRY: 1n << 20n,
  ROLE_SET_RESOLVER: 1n << 24n,
  ROLE_SET_URI: 1n << 36n,
  ROLE_UPGRADE: 1n << 124n,
};
export const RESOLVER = {
  ROLE_SET_ADDRESS: 1n << 0n,
  ROLE_SET_TEXT: 1n << 4n,
  ROLE_SET_CONTENTHASH: 1n << 8n,
  ROLE_SET_ABI: 1n << 12n,
  ROLE_SET_INTERFACE: 1n << 16n,
  ROLE_SET_NAME: 1n << 20n,
  ROLE_SET_DATA: 1n << 24n,
  ROLE_LINK: 1n << 28n,
  ROLE_CAN_NAME: 1n << 120n,
  ROLE_UPGRADE: 1n << 124n,
};
export const admin = (role: bigint) => role << 128n;
export const ROLE_CAN_TRANSFER_ADMIN = (1n << 28n) << 128n;
export const ALL_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111n;
export const TRIP_OWNER_BITMAP = REGISTRY.ROLE_SET_RESOLVER | admin(REGISTRY.ROLE_SET_RESOLVER);
export const OWNER_BITMAP =
  REGISTRY.ROLE_SET_SUBREGISTRY |
  admin(REGISTRY.ROLE_SET_SUBREGISTRY) |
  REGISTRY.ROLE_SET_RESOLVER |
  admin(REGISTRY.ROLE_SET_RESOLVER) |
  ROLE_CAN_TRANSFER_ADMIN;
export const CONCIERGE_TEXT_KEYS = ["friendship.now", "friendship.table"] as const;
export const hasRole = (bitmap: bigint, role: bigint) => (bitmap & role) === role;

// names.ts
export const labelSchema: z.ZodType<string>; // ENSIP-15 normalised, /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/, 3..32
export function suggestLabel(displayName: string): string; // first token, normalised, fallback "friend"
export function tripName(city: string, label: string): string; // `${label}.${city}.${parent}`
export function tableName(city: string, label: string): string; // `${label}.tables.${city}.${parent}`
export function tableLabel(kind: GatheringKind, startsAt: Date, suffix?: string): string; // `${kind}-${MMDD}-${HHmm}` JST, plus `-${suffix}`
export function conciergeName(city?: string): string; // `concierge.${parent}` or `concierge.${city}.${parent}`
export function dnsName(name: string): `0x${string}`; // toHex(packetToBytes(name))
export function labelId(label: string): bigint; // BigInt(keccak256(toHex(label)))
export const DEFAULT_TRIP_RECORDS: { avatar: string; url: string; description: string }; // "/art/tokyo.svg" made absolute with APP_ORIGIN, origin, "Travelling with New Friendship Tech"
export const FAR_FUTURE_EXPIRY = 4102444800; // 2100-01-01

// addresses.ts
export const SEPOLIA = {
  rootRegistry,
  ethRegistry,
  ethRegistrar,
  verifiableFactory,
  userRegistryImpl,
  permissionedResolverImpl,
  universalResolverV2,
  universalHelper,
  mockUsdc,
} as const; // values from docs, lower-case
export function parentName(): string; // ENS_PARENT_NAME, default "friendship-demo.eth" in demo, required otherwise
export function ensWorldEnv(): {
  parentRegistry;
  cityRegistryTokyo;
  appResolver;
  operatorKey;
  conciergeKey;
  rpcUrl;
} | null;
export function explorerName(name: string): string; // https://explorer.ens.dev/... (Sepolia explorer per docs) ; simulated: "#"
export function explorerTx(hash: string | null): string | null; // https://sepolia.etherscan.io/tx/
```

- [ ] **Step 1: Fetch the real ABIs.** From `https://raw.githubusercontent.com/ensdomains/contracts-v2/71a3b7339dbc55ab47667abdfe8303bac4f4c24e/contracts/deployments/sepolia/{UserRegistryImpl,PermissionedResolverImpl,VerifiableFactory,ETHRegistrar,MockUSDC}.json` extract the `abi` entries named: registry `register, renew, unregister, setSubregistry, setResolver, grantRootRoles, revokeRootRoles, getState, getStatus, getResolver, getSubregistry, hasRootRoles, initialize`; resolver `setText, setAddress, multicall, linkToNode, linkToRecord, grantSetterRoles, grantRootRoles, revokeRoles, hasRootRoles, getRecordId, initialize, resolve`; factory `deployProxy, ProxyDeployed`; registrar `makeCommitment, commit, register, isAvailable, getRegisterPrice, MIN_COMMITMENT_AGE`; USDC `mint`. Write them as `as const` arrays into `abi.ts` with a header comment citing the commit hash and URL. If the fetch fails, fall back to `parseAbi` human-readable signatures from the ENSv2 docs and say so in the header.

- [ ] **Step 2: Tests** (domain): `labelSchema` accepts `maya`, rejects `Ma ya`, `ab`, `-maya`; `suggestLabel("Maya Chen") === "maya"`; `tripName("tokyo","maya")` ends with `.tokyo.<parent>`; `tableLabel("dinner", new Date("2026-09-27T10:00:00Z")) === "dinner-0927-1900"`; `dnsName("a.eth") === "0x01610365746800"`; `labelId("alice")` equals `BigInt(keccak256(toHex("alice")))`; `hasRole(TRIP_OWNER_BITMAP, ROLE_CAN_TRANSFER_ADMIN) === false`; `hasRole(OWNER_BITMAP, ROLE_CAN_TRANSFER_ADMIN) === true`; `ALL_ROLES` has every registry and resolver role.

- [ ] **Step 3: Run, pass, commit** `feat(ens-v2): ABIs, role bitmaps, name rules and Sepolia addresses`.

---

### Task 3: Chain adapter (simulated + Sepolia) and write proof

**Files:** Create `src/server/ens-v2/chain.ts`, `simulated.ts`, `sepolia.ts`, `proof.ts`. Test: domain file.

**Interfaces (produces):**

```ts
export type Signer = "operator" | "concierge";
export type RecordWrite =
  | { type: "text"; key: string; value: string }
  | { type: "addr"; coinType: number; address: string };
export interface TxSubmission {
  hash: string;
  from: string;
  to: string;
  calldata: string;
}
export interface Receipt {
  status: "success" | "reverted" | "pending";
  from?: string;
  to?: string;
  input?: string;
  blockNumber?: number;
}
export class ChainRevert extends AppError {
  constructor(reason: string) {
    super("CHAIN_REVERT", reason, 409);
  }
}
export interface ChainAdapter {
  readonly kind: "simulated" | "sepolia";
  readonly addresses: {
    operator: string;
    concierge: string;
    cityRegistry: string;
    appResolver: string;
    usdc: string;
  };
  registerTrip(input: { label: string; owner: string; expiry: number }): Promise<TxSubmission>;
  renewTrip(input: { label: string; expiry: number }): Promise<TxSubmission>;
  unregisterTrip(label: string): Promise<TxSubmission>;
  setRecords(signer: Signer, name: string, records: RecordWrite[]): Promise<TxSubmission>;
  simulateSetText(signer: Signer, name: string, key: string, value: string): Promise<void>;
  readText(name: string, key: string): Promise<string | null>;
  readAddr(name: string, coinType?: number): Promise<string | null>;
  tripState(label: string): Promise<{
    status: "available" | "reserved" | "registered";
    expiry: number;
    owner: string | null;
  }>;
  receipt(hash: string): Promise<Receipt>;
  erc20Transfer(hash: string): Promise<{
    from: string;
    to: string;
    amount: bigint;
    token: string;
    success: boolean;
    finalized: boolean;
  } | null>;
  simulateTransfer?(input: { from: string; to: string; amount: bigint }): Promise<TxSubmission>; // simulated only
}
export function chain(): ChainAdapter; // simulated when isDemo(); otherwise SepoliaChain (throws ENS_UNAVAILABLE 503 if env incomplete)
export function resetSimulatedChain(): void; // tests
// proof.ts
export function assertChainWriteProof(input: {
  submission: TxSubmission;
  receipt: Receipt;
  expected: { name: string; records: RecordWrite[] };
  observed: Record<string, string | null>;
}): void;
// throws ENS_TX_FAILED (reverted/pending), ENS_TX_MISMATCH (from/to/input differ), ENS_RECORD_MISMATCH (observed[key] !== value)
```

Simulated rules: state lives on `globalThis.__nftechSimChain` (survives HMR). Signer addresses are fixed: operator `0x00000000000000000000000000000000000000a1`, concierge `0x00000000000000000000000000000000000000c1`. `setRecords`/`simulateSetText` with signer `concierge` and a text key outside `CONCIERGE_TEXT_KEYS`, or any addr write, throws `new ChainRevert("EACUnauthorizedAccountRoles")`. `readText`/`readAddr` return `null` when the name is a trip label in the city registry whose expiry has passed (models resolver fallback removal). `registerTrip` throws `ChainRevert("NameAlreadyRegistered")` when the label is registered and unexpired. Hashes are `0x` + 64 random hex. `erc20Transfer` returns the transfer recorded by `simulateTransfer` or null.

Sepolia rules: public client as in `ens.ts` (`ccipRead: false`); wallet clients from `privateKeyToAccount`; `setRecords` encodes each record with `encodeFunctionData` (`setText(dnsName, key, value)`, `setAddress(dnsName, coinType, address as bytes)`) and submits `multicall(bytes[])` to the app resolver from the signer; `simulateSetText` uses `publicClient.simulateContract({ account: signerAddress })` and maps any error to `ChainRevert(shortMessage)`; `readText` uses `getEnsText`, `readAddr` uses `getEnsAddress` (coinType passed through); `tripState` reads `getState(labelId)`; `erc20Transfer` parses `Transfer` logs on the receipt for `SEPOLIA.mockUsdc` and reports `finalized` when `latestBlock - receipt.block >= 2`.

- [ ] **Step 1: Tests (simulated):** register `maya` expiry now+1h then `readAddr` returns the owner after `setRecords(operator, ..., [{addr}])`; `setRecords("concierge", name, [{text friendship.now}])` succeeds; `setRecords("concierge", name, [{text description}])` rejects with `CHAIN_REVERT`; `simulateSetText("concierge", name, "description", "x")` rejects; registering the same label again rejects; after `resetSimulatedChain()` plus registering with `expiry = now - 1`, `readText` returns null; `assertChainWriteProof` throws `ENS_RECORD_MISMATCH` when observed differs and `ENS_TX_MISMATCH` when `receipt.to` differs.
- [ ] **Step 2: Implement, run, pass, typecheck (`sepolia.ts` compiles against viem 2.56), commit** `feat(ens-v2): chain adapter with simulated and Sepolia implementations`.

---

### Task 4: ENS jobs worker

**Files:** Create `src/server/ens-v2/jobs.ts`. Modify `src/worker/index.ts` (call `runEnsWorkerOnce(workerId)` after the payments worker; treat `worked = paymentsWorked || ensWorked`). Test: domain file (job mechanics) and later API tests.

**Interfaces (produces):**

```ts
export type JobHandler = (job: EnsJobRow, tx?: undefined) => Promise<{ txHash?: string }>; // handlers do their own applyWrite for final state
export function registerEnsJobHandler(kind: EnsJobKind, handler: JobHandler): void;
export async function enqueueEnsJob(
  tx: Tx,
  input: { kind: EnsJobKind; signer: EnsJobSigner; entityId: string; payload?: unknown },
): Promise<string>;
export async function runEnsWorkerOnce(owner?: string): Promise<boolean>; // lease 7 min, attempts+1, backoff min(300s, 10s * 2^min(attempts,5)), 12 attempts or terminal code -> status review
export async function drainEnsJobs(): Promise<void>; // demo/test only: loop runEnsWorkerOnce until false (guard isDemo())
export const TERMINAL_JOB_CODES = [
  "CHAIN_REVERT",
  "ENS_RECORD_MISMATCH",
  "ENS_TX_MISMATCH",
  "WRONG_RECIPIENT",
  "WRONG_PAYER",
  "UNDERPAID",
];
```

Handlers for `trip.*`, `record.set`, `table.write`, `split.verify` are registered by Tasks 7, 8, 9 (they import `registerEnsJobHandler`; `jobs.ts` never imports them, avoiding cycles).

- [ ] **Step 1: Test:** register a handler for kind `record.set` that throws `AppError("CHAIN_REVERT")`; enqueue; `runEnsWorkerOnce()` returns true, job status `review`, `lastError = CHAIN_REVERT`; a handler that succeeds marks `done` with `txHash`; a handler throwing `AppError("PENDING",...,409,true)` leaves `ready` with `attempts = 1` and `runAfter` in the future.
- [ ] **Step 2: Implement, pass, commit** `feat(ens-v2): leased ENS job worker with retry and review states`.

---

### Task 5: World adapter (simulated + live)

**Files:** Create `src/server/world/adapter.ts`, `simulated.ts`, `live.ts`. Test: domain + `tests/world.test.ts` (pure parts).

**Interfaces (produces):**

```ts
export interface RpContextDTO {
  rp_id: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
  app_id: string;
  action: string;
  environment: "production" | "staging" | "sandbox" | "simulated";
}
export interface VerifiedProof {
  nullifier: string /* decimal */;
  signalHash: string | null;
  issuerSchemaId: string | null;
  expiresAtMin: Date | null;
  environment: string;
}
export interface AgentIdentity {
  issuer: string;
  sub: string;
  nonce: string;
  authTime: Date;
  acr?: string;
}
export interface WorldAdapter {
  readonly kind: "simulated" | "live";
  rpContext(action: string): Promise<RpContextDTO>;
  verifyProof(input: { payload: unknown; action: string; signal: string }): Promise<VerifiedProof>; // throws WORLD_VERIFY_FAILED 422 | WORLD_CREDENTIAL_UNAVAILABLE 422 | WORLD_SIGNAL_MISMATCH 422
  agentAuthorizeUrl(input: {
    approvalId: string;
    nonce: string;
    codeChallenge: string;
    fresh: boolean;
  }): Promise<string>;
  agentExchange(input: { code: string; codeVerifier: string }): Promise<AgentIdentity>; // throws WORLD_AGENT_TOKEN 401
}
export function world(): WorldAdapter; // simulated when isDemo(); live otherwise (throws WORLD_UNAVAILABLE 503 when WORLD_APP_ID/RP_ID/RP_SIGNING_KEY missing)
export function nullifierToDecimal(hex: string): string; // BigInt(hex).toString(); throws WORLD_VERIFY_FAILED on bad input
export const simulatedProofSchema = z
  .object({
    simulated: z.literal(true),
    human: z.string().min(1).max(80),
    unavailable: z.boolean().optional(),
  })
  .strict();
```

Simulated: `verifyProof` parses `simulatedProofSchema` (else `WORLD_VERIFY_FAILED`), throws `WORLD_CREDENTIAL_UNAVAILABLE` when `unavailable`, returns `nullifier = BigInt(keccak256(toHex("sim:" + human))).toString()`, `signalHash = keccak256(toHex(signal))`, `environment: "simulated"`. `agentAuthorizeUrl` returns `simulated://approval/${approvalId}`. `agentExchange` throws `WORLD_AGENT_TOKEN`. `rpContext` returns placeholders with `environment: "simulated"`.

Live: `rpContext` = `signRequest({ signingKeyHex: WORLD_RP_SIGNING_KEY, action })` mapped to the DTO with `rp_id`, `app_id`, `environment = WORLD_ENVIRONMENT` (default `staging`). `verifyProof`: POST `https://developer.world.org/api/v4/verify/${rp_id}` with the payload as-is (`AbortSignal.timeout(15000)`), require `response.ok && body.success === true`, require `body.environment === WORLD_ENVIRONMENT`, take `nullifier` from `body.nullifier ?? body.results?.[0]?.nullifier`, read `issuer_schema_id`, `expires_at_min`, `signal_hash` from `payload.responses[0]`; when `signal_hash` is present and not `0x0`, require `signal_hash === hashSignal(signal)` (from `@worldcoin/idkit-core/hashing`) else `WORLD_SIGNAL_MISMATCH`. OIDC: discovery cached from `${WORLD_AGENTS_ISSUER}/.well-known/openid-configuration`; `agentAuthorizeUrl` = `authorization_endpoint` + `response_type=code&client_id&redirect_uri=WORLD_AGENTS_REDIRECT_URI&scope=openid&state=<approvalId>&nonce=<nonce>&code_challenge=<S256>&code_challenge_method=S256` plus `&prompt=login&max_age=0` when `fresh`; `agentExchange` posts `grant_type=authorization_code&code&redirect_uri&code_verifier` with `Authorization: Basic base64(clientId:clientSecret)`, then `jwtVerify(id_token, createRemoteJWKSet(new URL(jwks_uri)), { issuer, audience: clientId, algorithms: ["RS256"] })`, returns `{ issuer: iss, sub, nonce, authTime: new Date(auth_time * 1000), acr }`; missing `auth_time` when `fresh` is the caller's problem (approvals compare it).

- [ ] **Step 1: Tests:** `nullifierToDecimal("0x0a") === "10"`; simulated `verifyProof` is deterministic for the same `human` and different across humans; `unavailable` throws `WORLD_CREDENTIAL_UNAVAILABLE`; garbage payload throws `WORLD_VERIFY_FAILED`; `world().kind === "simulated"` under the test env; `hashSignal("tokyo")` is a 0x hex string (import works).
- [ ] **Step 2: Implement, pass, commit** `feat(world): World ID adapter with simulated and live (IDKit v4 + OIDC) implementations`.

---

### Task 6: Agent approvals state machine

**Files:** Create `src/server/world/approvals.ts`. Test: `tests/world.test.ts`.

**Interfaces (produces):**

```ts
export type ApprovalExecutor = (
  tx: Tx,
  approval: ApprovalRow,
  user: UserRow,
) => Promise<string | null>; // returns resultId
export function registerApprovalExecutor(action: ApprovalAction, executor: ApprovalExecutor): void;
export async function requestApproval(
  user: UserRow,
  input: { action: ApprovalAction; payload: unknown; summary: string },
): Promise<ApprovalDTO>;
// agent.link: 10 min expiry, no linked-sub requirement. Others: 2 min expiry, require user.worldAgentSub (else AGENT_NOT_LINKED 409).
export async function approvalStatus(user: UserRow, id: string): Promise<ApprovalDTO>; // computes expired lazily and persists it
export async function finishApproval(input: {
  approvalId: string;
  code?: string;
  error?: string;
  identity?: AgentIdentity;
}): Promise<ApprovalDTO>;
export function approvalDTO(row: ApprovalRow, url?: string | null): ApprovalDTO;
export function pkce(): { verifier: string; challenge: string }; // 43-char base64url verifier, S256 challenge
```

`finishApproval` rules (in order): row must exist (404); if `status` is `consumed` or `approved` -> audit `approval.replay`, throw `APPROVAL_CONSUMED` 409; if `denied`/`expired` -> throw `APPROVAL_CLOSED` 409; if `expiresAt <= now` -> set `expired`, throw `APPROVAL_EXPIRED` 409; if `error` -> set `denied`, return DTO; identity = `input.identity ?? world().agentExchange({ code, codeVerifier })`; `identity.nonce !== row.nonce` -> `APPROVAL_NONCE` 401; if `action === "agent.link"` -> set `users.worldAgentIssuer/Sub`; else require `identity.sub === user.worldAgentSub` (`APPROVAL_SUBJECT` 403) and `identity.authTime >= row.createdAt - 60s` (`APPROVAL_STALE` 401); then one `applyWrite(user.id, "approval." + action, row.id, tx => { update approved/worldSub/authTime; resultId = await executor(tx, row, user); update consumed, consumedAt, resultId })`. Executors re-validate business state; if an executor throws, the row is left `approved` but unconsumed and the error propagates (the audit trail shows it); a retry is a new approval.

The URL in `ApprovalDTO.url` is regenerated on `requestApproval` only; `approvalStatus` returns `url: null` for non-pending rows. `simulated` is `world().kind === "simulated"`.

- [ ] **Step 1: Tests (API-level, demo env):** link flow: `POST /api/world/agent/link` (Task 7 wires the route; for this task call `requestApproval` directly) then `finishApproval({ approvalId, identity: { issuer: "sim", sub: "sim:maya", nonce: row.nonce, authTime: new Date() } })` sets `users.worldAgentSub`; a `table.request` approval before linking throws `AGENT_NOT_LINKED`; nonce mismatch throws `APPROVAL_NONCE`; wrong sub throws `APPROVAL_SUBJECT`; `authTime` two minutes before `createdAt` throws `APPROVAL_STALE`; `error: "access_denied"` yields `denied` and the executor is not called; a row with `expiresAt` in the past yields `expired`; finishing twice throws `APPROVAL_CONSUMED` and writes an `approval.replay` audit row; a registered executor for `now.publish` runs inside the transaction and its return lands in `resultId`.
- [ ] **Step 2: Implement, pass, commit** `feat(world): agent approval state machine with executor registry`.

---

### Task 7: Trips service, routes, router integration

**Files:** Create `src/server/ens-world/trips.ts`, `dto.ts`, `router.ts`. Modify `src/server/router.ts` (config keys; `optional` predicate; delegate call before the `UNAUTHENTICATED` invariant; `worldEnabled` etc.). Test: `tests/trips.test.ts`.

**Interfaces (produces):**

```ts
// trips.ts
export const activateSchema = z
  .object({
    city: z
      .string()
      .regex(/^[a-z-]+$/)
      .default("tokyo"),
    label: labelSchema.optional(),
    arrivesAt: z.string().datetime(),
    departsAt: z.string().datetime(),
    proof: z.unknown(),
  })
  .strict();
export async function activateTrip(
  user: UserRow,
  body: z.infer<typeof activateSchema>,
): Promise<TripDTO>;
export async function extendTrip(
  user: UserRow,
  body: { city?: string; departsAt: string },
): Promise<TripDTO>;
export async function endTrip(user: UserRow, city?: string): Promise<TripDTO>;
export async function myTrip(user: UserRow, city?: string): Promise<TripDTO | null>;
export async function activeTripFor(
  userId: string,
  city: string,
  db?: Tx | Database,
): Promise<TripRow | null>; // status active only
export async function tripByName(name: string): Promise<{
  name: string;
  city: string;
  active: boolean;
  departsAt: string;
  verifiedHuman: boolean;
  now: NowRecord | null;
}>;
export async function tripBadges(
  userIds: string[],
  city?: string,
): Promise<Map<string, { tripName: string; verifiedHuman: boolean; now: NowRecord | null }>>;
export async function expireTrips(now?: Date): Promise<number>; // active & departsAt <= now -> expired + trip.expire job
export async function setPayRecord(
  user: UserRow,
  body: { city?: string; enabled: boolean },
): Promise<TripDTO>; // record.set addr coinType 2147500 (0x80000000 + 16661) via operator, payAddress snapshot
export function tripDTO(row: TripRow, user: UserRow | { verifiedHumanAt: Date | null }): TripDTO;
// dto.ts: explorer links, nowRecord parsing (JSON text -> NowRecord | null)
// router.ts (ens-world)
export function isPublicPath(path: string, method: string): boolean; // GET trips/<name> where name contains ".", GET world/agent/callback
export async function handle(ctx: {
  path: string;
  method: string;
  request: Request;
  url: URL;
  actor: UserRow | null;
  correlationId: string;
  ok: (data: unknown, status?: number, extra?: Record<string, string>) => Response;
}): Promise<Response | null>;
```

`activateTrip` order: `requireMember`; `publishedCity`; dates: `arrivesAt < departsAt`, `departsAt > now + 1h`, `departsAt <= now + 90d` (`TRIP_DATES` 422); `world().verifyProof({ payload: body.proof, action: WORLD_ACTION_TRIP, signal: body.city })`; label = `body.label ?? suggestLabel(user.name)`; `applyWrite(user.id, "trip.activate", city, tx => { lock user row; SELECT pg_advisory_xact_lock(hashtext(city || ':' || nullifier)); if active/pending trip for user in city -> TRIP_EXISTS 409; if any trip in (pending_chain, active) in city joined to human_proofs with same nullifier -> HUMAN_ALREADY_PRESENT 409; insert human_proofs; resolve label collisions by appending -2, -3...; insert trip pending_chain with ensName/labelhash/registry/resolver from chain().addresses; set users.verifiedHumanAt if null; enqueueEnsJob trip.register { tripId } signer operator })`; if `isDemo()` -> `await drainEnsJobs()`; return `tripDTO`.

Job handlers registered here: `trip.register` (registerTrip -> receipt -> setRecords operator [addr60 = owner wallet (first `walletLinks` address, else `TRIP_NO_WALLET` review), text friendship.trip = JSON `{ city, arrivesAt, departsAt, verifiedHuman: true }`, avatar, url, description] -> receipt -> readAddr + readText friendship.trip -> `assertChainWriteProof` -> trip `active`, `chainTx`, `recordsTx`, `chainVerifiedAt`); `trip.renew` (renewTrip -> receipt -> tripState expiry >= new -> update); `trip.expire` (setRecords operator clearing addr and the friendship.* keys with empty values, then unregisterTrip if `tripState().status === "registered"`; ignore `NameAlreadyExpired`-style reverts); `record.set` (`payload: { key, value, signer }` -> setRecords -> receipt -> readText compare -> store hash in `nowTx` or `payTx` by key).

Routes added to `ens-world/router.ts` in this task: `GET world/rp-context?action=`, `POST world/verify` (activateTrip), `POST world/agent/link` (requestApproval agent.link), `GET world/agent/callback` (finishApproval with `code`/`error`; then `302` to `/approvals/<id>`), `POST world/agent/simulate` (demo only; `{ approvalId, decision: "approve"|"deny", human }` -> `finishApproval` with `identity = { issuer: "simulated", sub: "sim:" + human, nonce: row.nonce, authTime: now }` or `error: "access_denied"`), `GET trips/me?city=`, `POST trips/extend`, `POST trips/end`, `POST trips/pay-record`, `GET trips/<name>`, `GET approvals/<id>`.

Main router patch (exact): (1) add to the `config` response: `world: { enabled, appId, rpId, environment, action, simulated }`, `ensParent: parentName()`, `splitOgPayEnabled`; (2) `optional` predicate gains `|| ensWorld.isPublicPath(path, method)`; (3) after `await rateLimit(request, actor?.id);` insert `const handled = await ensWorld.handle({ path, method, request, url, actor, correlationId, ok: (data, status, extra) => ok(data, correlationId, status, extra) }); if (handled) return handled;` placed before `invariant(actor, "UNAUTHENTICATED", ...)`. Inside `ensWorld.handle`, every non-public route starts with `invariant(ctx.actor, "UNAUTHENTICATED", "Sign in to continue.", 401)`.

- [ ] **Step 1: Tests (`tests/trips.test.ts`):** Maya activates with `{ proof: { simulated: true, human: "h-maya" } }` -> 201, `status === "active"`, `name === "maya.tokyo.<parent>"`, `chainTx` set, `verifiedHuman === true`; `GET trips/me` returns it; unauthenticated `GET trips/maya.tokyo.<parent>` returns `{ active: true, verifiedHuman: true }` and no `id`/wallet keys; Alex (no All Access) -> 403 `MEMBERSHIP_REQUIRED`; Kenji with the same `human` -> 409 `HUMAN_ALREADY_PRESENT`; `{ simulated: true, human: "x", unavailable: true }` -> 422 `WORLD_CREDENTIAL_UNAVAILABLE`; `{ garbage: true }` -> 422 `WORLD_VERIFY_FAILED` and no trip row; second activation by Maya -> 409 `TRIP_EXISTS`; label collision: Ari activates with `label: "maya"` -> gets `maya-2`; extend to a later date updates `departsAt`; extend to an earlier date -> 422; `expireTrips(new Date(departsAt + 1s))` marks expired and `readText(name, "friendship.trip")` returns null; after expiry Kenji activates with Maya's `human` -> 201 (nullifier free again); `POST trips/pay-record { enabled: true }` sets `payAddress` and `payTx`.
- [ ] **Step 2: Implement, pass, commit** `feat(trips): expiring ENSv2 trip names gated by World ID proof of human`.

---

### Task 8: Gatherings (tables) service and on-chain record

**Files:** Create `src/server/ens-world/gatherings.ts`. Modify `ens-world/router.ts` (routes). Test: `tests/gatherings.test.ts`.

**Interfaces (produces):**

```ts
export const createGatheringSchema = z
  .object({
    city: z.string().default("tokyo"),
    kind: z.enum(["coffee", "breakfast", "lunch", "dinner", "drinks"]),
    placeId: z.string().uuid().optional(),
    area: z.string().trim().min(1).max(60),
    startsAt: z.string().datetime(),
    seats: z.number().int().min(2).max(8),
  })
  .strict();
export async function createGathering(host: UserRow, body): Promise<GatheringDetail>;
export async function requestSeat(
  user: UserRow,
  gatheringId: string,
  body: { plusOnes: number },
): Promise<ApprovalDTO>; // approval table.request
export async function approveSeat(
  host: UserRow,
  gatheringId: string,
  body: { attendeeId: string },
): Promise<ApprovalDTO>; // approval table.approve
export async function declineSeat(
  host: UserRow,
  gatheringId: string,
  body: { attendeeId: string },
): Promise<GatheringDetail>;
export async function leaveGathering(user: UserRow, gatheringId: string): Promise<GatheringDetail>;
export async function cancelGathering(host: UserRow, gatheringId: string): Promise<GatheringDetail>;
export async function closeGathering(host: UserRow, gatheringId: string): Promise<GatheringDetail>;
export async function listGatherings(
  user: UserRow | null,
  city: string,
): Promise<GatheringSummary[]>; // status open|full|closed, startsAt > now - 6h, limit 60
export async function gatheringDetail(user: UserRow | null, id: string): Promise<GatheringDetail>;
export async function tableRecord(gatheringId: string, db?): Promise<string>; // the JSON string written on chain (spec 6.3; attendees = approved trip names incl. host; guests = sum plusOnes; expiresAt = startsAt + 6h; place = place slug or null)
export function seatsTaken(attendees: AttendeeRow[]): number; // approved rows: 1 + plusOnes each
```

Rules: host needs `activeTripFor(host.id, city)` (`TRIP_REQUIRED` 403) and `verifiedHumanAt` (`HUMAN_REQUIRED` 403); `startsAt` within `[now - 1h, now + 14d]`; place, if given, must be published in the city; label = `tableLabel(kind, startsAt)` with a 4-hex suffix on collision; insert gathering + host attendee (`approved`, `plusOnes 0`); enqueue `table.write` (concierge); demo drains inline. `requestSeat`: requester has an active trip in the city and is a verified human, is not the host, is not blocked either way (`blockedIds`), has no attendee row (or a `left` one: then update), seats available for `1 + plusOnes`; then `requestApproval(user, { action: "table.request", payload: { gatheringId, plusOnes }, summary })`. Executor `table.request` re-checks seats and blocks, inserts/updates the attendee row `requested` with `approvalId`, returns attendee id. `approveSeat`: host only, attendee `requested`; approval `table.approve` payload `{ gatheringId, attendeeId }`; executor sets `approved`, sets gathering `full` when `seatsTaken >= seats`, enqueues `table.write`, returns attendee id. `declineSeat`, `leaveGathering`, `cancelGathering`, `closeGathering` are direct writes; each that changes attendance or status enqueues `table.write`. `table.write` handler: `chain().setRecords("concierge", ensName, [{ text friendship.table, value: tableRecord }])` -> receipt -> `readText` compare -> `chainRecordTx`, `chainVerifiedAt`; for `cancelled` and for `closed` older than 24h, the value written is `""`.

Routes: `GET gatherings?city=`, `POST gatherings`, `GET gatherings/<id>`, `POST gatherings/<id>/request`, `/approve`, `/decline`, `/leave`, `/cancel`, `/close`.

- [ ] **Step 1: Tests:** activate Maya, Kenji, Ari (distinct humans) and link Kenji, Maya and Ari agents via the simulate route; Kenji hosts `dinner` for 4 -> 201, `name` ends `.tables.tokyo.<parent>`, `chainRecordTx` set and `chain().readText(name, "friendship.table")` parses to `{ v: 1, kind: "dinner", seats: 4, attendees: ["kenji.tokyo.<parent>"], guests: 0, status: "open" }`; Alex (no trip) hosting -> 403; Maya requests with `plusOnes: 1` -> approval DTO `pending`; the attendee row does not exist yet; `POST world/agent/simulate approve` -> attendee `requested`; simulate again with the same approval -> 409 `APPROVAL_CONSUMED`; Kenji approves via his own approval -> attendee `approved`, record attendees now two names, `guests: 1`; Ari requests and simulate `deny` -> approval `denied`, no attendee row, record unchanged; Ari requests again, let it expire (update `expiresAt` in DB) -> simulate -> 409 `APPROVAL_EXPIRED`, no row; seats: with 4 seats and Maya+1 approved (3 taken), a request with `plusOnes: 1` -> 409 `TABLE_FULL`; Maya leaves -> record attendees back to one; host close -> status `closed`; a blocked pair cannot request (404).
- [ ] **Step 2: Implement, pass, commit** `feat(tables): data-only ENSv2 table names with approval-gated seats and concierge-written records`.

---

### Task 9: Split the bill

**Files:** Create `src/server/ens-world/split.ts`. Modify `ens-world/router.ts`. Test: `tests/gatherings.test.ts` (split section) + domain (maths).

**Interfaces (produces):**

```ts
export function computeShares(input: {
  totalCents: number;
  members: { id: string; plusOnes: number }[];
  hostId: string;
}): { unitCents: number; hostCents: number; shares: Map<string, number> };
// people = members.length + sum(plusOnes); unit = ceil(total / people); non-host member share = unit; host = total - sum(non-host shares)
export const USDC_DECIMALS = 6;
export const usdcBaseUnits = (cents: number) => BigInt(cents) * 10_000n;
export async function startSplit(
  host: UserRow,
  gatheringId: string,
  body: { totalCents: number },
): Promise<GatheringDetail>; // gathering status in open|full|closed, splitStatus none; snapshots host pay address = chain().readAddr(hostTripName) (fallback readAddr coinType 60), sets attendee shareCents + payAddress, splitStatus pending
export async function reportPayment(
  user: UserRow,
  gatheringId: string,
  body: { txHash: string },
): Promise<GatheringDetail>; // hint only: sets paidTx, enqueues split.verify
export async function simulatePayment(user: UserRow, gatheringId: string): Promise<GatheringDetail>; // demo only: chain().simulateTransfer from user's first wallet to payAddress of usdcBaseUnits(share) then reportPayment
```

`split.verify` handler: `chain().erc20Transfer(paidTx)`; null -> `PENDING` retryable; `to !== payAddress` -> `WRONG_RECIPIENT`; `from` not in the attendee's `walletLinks` -> `WRONG_PAYER`; `amount < usdcBaseUnits(shareCents)` -> `UNDERPAID`; `!success` -> `PENDING`; `!finalized` -> `PENDING`; else `paidVerifiedAt = now`, and when every non-host approved attendee is verified -> gathering `splitStatus = settled`.

Routes: `POST gatherings/<id>/split { totalCents }`, `POST gatherings/<id>/split/paid { txHash }`, `POST gatherings/<id>/split/simulate` (demo only, 404 otherwise).

- [ ] **Step 1: Tests:** `computeShares({ totalCents: 10000, members: [host, a(+1), b], hostId })` -> people 4, unit 2500, a 2500, b 2500, host 5000; rounding `totalCents: 10001` -> unit 2501, host 4999; API: after Task 8 state (Kenji host, Maya approved), Kenji starts split 12000 -> Maya `shareCents 4000` (people 3 with her plus-one), `payTo` = Kenji's address, `amountBaseUnits "40000000"`; Maya `split/paid` with a random hash -> `paidTx` stored, `verified false`, split still `pending` (hint ignored); Maya `split/simulate` -> `verified true`, gathering `settled`; a non-attendee posting a hint -> 404.
- [ ] **Step 2: Implement, pass, commit** `feat(split): equal shares resolved from trip names, chain-verified USDC settlement`.

---

### Task 10: Concierge (tools, rule brain, agent turn, Right now via approval, MCP)

**Files:** Create `src/server/ens-world/concierge/{tools,brain,agent,mcp}.ts`, `src/app/api/mcp/route.ts`, `src/server/ens-world/concierge/README.md`. Modify `ens-world/router.ts`. Test: `tests/world.test.ts` (concierge section).

**Interfaces (produces):**

```ts
// tools.ts (read-only, names only)
export async function openTables(city: string): Promise<GatheringSummary[]>;
export async function whoIsAround(city: string): Promise<{ name: string; now: NowRecord }[]>;
export async function resolveTrip(name: string): Promise<ReturnType<typeof tripByName>>;
// brain.ts
export interface Proposal { action: ApprovalAction; payload: unknown; summary: string }
export interface BrainInput { user: { id: string; name: string; neighborhood: string }; city: string; message: string; context: { openTables: GatheringSummary[]; whoIsAround: { name: string; now: NowRecord }[]; myTrip: TripDTO | null; pendingRequests: { id: string; from: string }[] } }
export interface BrainOutput { reply: string; proposals: Proposal[] }
export interface ConciergeBrain { readonly name: string; respond(input: BrainInput): Promise<BrainOutput> }
export class RuleBrain implements ConciergeBrain { ... }
export function brain(): ConciergeBrain;   // CONCIERGE_BRAIN = "rules" (default) | "custom" -> dynamic import of "@/server/ens-world/concierge/custom-brain" which the owner supplies (throws CONCIERGE_UNAVAILABLE 503 when missing)
// agent.ts
export async function turn(user: UserRow, body: { city: string; message: string }): Promise<{ reply: string; approvals: ApprovalDTO[] }>;
export async function publishNow(user: UserRow, body: { city: string; kind: string; area: string; until: string }): Promise<ApprovalDTO>;  // approval now.publish
// executor now.publish: social.createNow(user.id, { kind, neighborhood: area, city, note: summary, hours }) then enqueue record.set { key: "friendship.now", value: JSON { kind, area, until }, signer: "concierge" } on the trip; returns post id. Requires active trip.
// executor contact.reveal: social.respondRequest(user.id, payload.requestId, "accept"); returns requestId.
// mcp.ts
export async function handleMcp(request: Request): Promise<Response>;  // JSON-RPC 2.0: initialize (protocolVersion "2025-06-18", capabilities { tools: {} }, serverInfo { name: "friendship-concierge", version }), notifications/initialized -> 202, ping, tools/list, tools/call for resolveTrip|openTables|whoIsAround; unknown method -> -32601; GET -> 405
```

RuleBrain routing (case-insensitive): `/who.?s? (around|here)|around tonight/` -> reply lists `whoIsAround` names and open tables, no proposals; `/(find|any|looking for|want).*(dinner|lunch|coffee|breakfast|drinks)/` -> first open table of that kind with seats -> proposal `table.request` `{ gatheringId, plusOnes: 0 }`, else reply "nothing open"; `/(post|free|available).*(coffee|food|drinks|work|walk|event|business).*until (\d{1,2})(?::(\d{2}))?/` -> proposal `now.publish` `{ kind (mapped to INTENTS casing), area: user.neighborhood, until: today HH:MM JST ISO }`; `/accept.*(request|intro)/` -> one `contact.reveal` proposal per pending incoming request; otherwise a help reply naming the three canned prompts. Replies never include wallets or contacts.

Routes: `POST concierge/chat { city, message }`, `POST concierge/now { city, kind, area, until }`.

- [ ] **Step 1: Tests:** with Maya's trip active and Kenji's dinner open: `concierge/chat "who's around tonight"` reply contains `kenji.tokyo` (Kenji has a `friendship.now` after `concierge/now` approved via simulate) and no `0x`; `"find me a dinner"` returns one approval with `action table.request`; `"post that I'm free for coffee until 18:00"` returns a `now.publish` approval; simulate approve -> a `now_posts` row exists and `readText(mayaTrip, "friendship.now")` parses with `kind: "Coffee"`; `whoIsAround` now lists Maya; MCP: `POST /api/mcp` `initialize` -> 200 with `serverInfo`; `tools/list` -> three tools; `tools/call openTables { city: "tokyo" }` -> content text JSON with Kenji's table; `tools/call` unknown -> error `-32602`; the MCP route ignores `Origin`.
- [ ] **Step 2: Implement, pass, commit** `feat(concierge): rule brain, approval-gated Right now, read-only MCP endpoint`.

---

### Task 11: UI part 1: human check, approval modal, trip card, badges

**Files:** Create `src/components/human-check.tsx`, `src/components/approval-modal.tsx`, `src/components/views/trip-card.tsx`. Modify `src/components/views/account.tsx` (mount `<TripCard />` as the first `settings-panel`), `src/components/session.tsx` (`RuntimeConfig` gains `world`, `ensParent`, `splitOgPayEnabled`), `src/server/social.ts` (`publicMember(row, ensName, extras?)`; `listMembers` and `memberDetail` call `tripBadges`), `src/lib/types.ts` (`PublicMember` gains `tripName: string | null; verifiedHuman: boolean; now: NowRecord | null`), `src/components/views/people.tsx` (`MemberCard` shows `tripName · Sepolia`, `Verified human` tag, `now` line).

**Interfaces (produces):**

```tsx
export function HumanCheck(props: {
  city: string;
  label: string;
  arrivesAt: string;
  departsAt: string;
  onActivated: (trip: TripDTO) => void;
  onCancel: () => void;
}): JSX.Element;
// demo: SimulatedHumanPanel with "Human identity" input (default "human-<first 6 of user id>"), buttons "Verify as this human", "Credential unavailable", "Cancel"; production: fetch GET world/rp-context?action=<config.world.action>, then render IDKitRequestWidget (dynamic import ssr:false) with preset proofOfHuman({ signal: city }) and a second "Use passport instead" button switching preset to passport({ signal: city }); handleVerify posts POST world/verify { city, label, arrivesAt, departsAt, proof: result }; onError shows the code with plain copy for cancel ("You closed World ID. No trip was created.").
export function ApprovalModal(props: {
  approval: ApprovalDTO | null;
  onClose: () => void;
  onResolved: (approval: ApprovalDTO) => void;
}): JSX.Element;
// polls GET approvals/<id> every 2s while pending; demo (approval.simulated): "Simulated World ID app" panel with Approve / Deny buttons posting world/agent/simulate { approvalId, decision, human }; production: "Open World ID" link (target _blank) to approval.url; terminal copy: approved "Approved. The concierge did it.", denied "You declined. Nothing was written.", expired "This approval expired after two minutes. Nothing was written.".
export function useApprovalFlow(): {
  approval: ApprovalDTO | null;
  start: (path: string, body?: unknown) => Promise<void>;
  close: () => void;
  onResolved: (fn: (a: ApprovalDTO) => void) => void;
};
export function TripCard(): JSX.Element;
// states: no trip -> form (label prefilled from name, arrives/departs date inputs, "Activate with World ID" -> HumanCheck); pending_chain -> pending copy + Etherscan link; active -> name (mono), expiry, "Verified human" tag, links (name explorer, tx), Extend (date input) / End; plus "Pay record" toggle (POST trips/pay-record) and "Let the concierge act for you" (POST world/agent/link -> ApprovalModal) showing "Linked" when me.user.worldAgentLinked; concierge panel text: concierge name + the two permitted keys.
```

`Me.user` gains `verifiedHuman: boolean; worldAgentLinked: boolean` (patch `social.me`).

- [ ] **Step 1: Implement; run `npm run typecheck` and `npm run build`; boot `npm run demo` and click through: Maya activates (simulated), sees the name and links the concierge with the simulated approve; Kenji sees Maya's `Verified human` badge in People.**
- [ ] **Step 2: Commit** `feat(ui): trip activation with World ID, approval modal, verified-human badges`.

---

### Task 12: UI part 2: tables list, table detail, split, routes, styles

**Files:** Create `src/components/views/tables.tsx`, `src/components/views/table-detail.tsx`, `src/app/ens-world.css`. Modify `src/components/platform.tsx` (`second === "tables" && !third` -> `<TablesView city />`, `second === "tables" && third` -> `<TableDetailView id={third} city />`, `first === "approvals" && second` -> `<ApprovalResultView id={second} />` exported from `approval-modal.tsx`), `src/components/app-shell.tsx` (Travel submenu item `["/" + citySlug + "/tables", "Tables", "Meals with verified humans"]`), `src/app/globals.css` (first line after the tailwind import: `@import "./ens-world.css";`).

**Interfaces:** `TablesView({ city })`: list of `GatheringSummary` cards (kind tag, place or area, `dateLabel(startsAt)`, `seatsLeft` of `seats`, host name + `Verified human`, record link `explorer.name`, tx link, "Ask to join" with a "+1" checkbox -> `useApprovalFlow().start("gatherings/<id>/request", { plusOnes })`; own tables show "Manage"), "Host a table" modal (kind chips, area select from `NEIGHBORHOODS.slice(1)`, place select from `GET places?city=`, datetime-local input, seats 2..8) -> `POST gatherings`; requires an active trip (`AccessState`-style empty state linking to `/settings` otherwise). `TableDetailView({ id, city })`: header, record link and tx, attendees (name mono + badge + plus-one + status), host controls (Approve -> approval flow, Decline, Close, "Split the bill" input in USD -> `split`), member controls (Leave, and when split pending: share, pay-to name, "Pay" -> demo `split/simulate`; production `walletProvider()` -> `eth_sendTransaction` to USDC `transfer(to, amount)` calldata, then `split/paid { txHash }`; `SPLIT_OGPAY_ENABLED` mounts `OgPayTrigger` instead with the resolved recipient and `outputAmount`), settled state, and the raw `record` JSON in a `<details>`.

- [ ] **Step 1: Implement; typecheck; build; demo click-through of spec section 10 steps 3, 4, 5 and 7 (Kenji hosts, Maya asks via approval, Kenji approves via approval, Ari denies, split settles with simulate).**
- [ ] **Step 2: Commit** `feat(ui): tables with on-chain records, approval-gated seats and split`.

---

### Task 13: UI part 3: concierge drawer and Right now via concierge

**Files:** Create `src/components/concierge-drawer.tsx`. Modify `src/components/app-shell.tsx` (mount `<ConciergeDrawer city={citySlug} />` inside `app-frame` when `me`), `src/components/views/now-events.tsx` (the "Make a plan" form posts `concierge/now { city, kind, area, until }` where `until = now + hours`, then opens `ApprovalModal`; copy "Ask the concierge to post it").

**Interfaces:** `ConciergeDrawer({ city })`: floating button bottom-right (`aria-label="Open concierge"`), drawer with three prompt chips ("who's around tonight", "find me a dinner", "post that I'm free for coffee until 18:00"), message list, input; each reply's approvals render as "Approve in World ID" buttons opening `ApprovalModal`; header shows `concierge.<parent>` and "may write friendship.now and friendship.table only".

- [ ] **Step 1: Implement; typecheck; build; demo: Maya asks "find me a dinner", approves, Kenji approves; "post that I'm free for coffee until 18:00" shows in People as her now line.**
- [ ] **Step 2: Commit** `feat(ui): concierge drawer and approval-gated Right now`.

---

### Task 14: Bootstrap and smoke scripts (Sepolia, typecheck only)

**Files:** Create `scripts/ens-bootstrap.ts`, `scripts/ens-smoke.ts`, `src/server/ens-v2/bootstrap.ts`. Add npm scripts `ens:bootstrap` and `ens:smoke` (`node --import tsx scripts/...`).

`bootstrap.ts` exports `bootstrap(options: { registerParent: boolean; version: bigint; out: string })` performing, with the operator wallet on Sepolia: (0, optional) mint 100 MockUSDC, approve ETHRegistrar, `makeCommitment`, `commit`, wait 75s, `register(label, operator, secret, 0x0, 0x0, 365d, mockUsdc, 0x0)`; (1) deploy app resolver via `deployProxy(permissionedResolverImpl, salt("OwnedResolver", operator, version), initialize([{operator, ALL_ROLES}], []))` and read `ProxyDeployed`; (2) deploy parent registry (`salt("UserRegistry", namehash(parent), version)`, `initialize([{operator, ALL_ROLES}])`); (3) `ETHRegistry.setSubregistry(labelId(parentLabel), parentRegistry)`; (4) deploy city registry (`namehash("tokyo." + parent)`); (5) `parentRegistry.register("tokyo", operator, cityRegistry, 0x0, OWNER_BITMAP, FAR_FUTURE)`; (6) `parentRegistry.register("concierge", operator, 0x0, appResolver, OWNER_BITMAP, FAR_FUTURE)`; (7) `cityRegistry.register("tables", ...appResolver...)` and `cityRegistry.register("concierge", ...appResolver...)`; (8) `appResolver.grantSetterRoles(encodeFunctionData(setText, ["0x", "friendship.now", ""]), concierge)` and the same for `friendship.table`; (9) operator `multicall` on the resolver: `setAddress(dnsName(concierge.parent), 60, concierge)`, `setText agent-context` (markdown from `names.ts` `CONCIERGE_CONTEXT(origin)`), `agent-endpoint[mcp]`, `agent-endpoint[web]`; (10) `linkToNode(dnsName("concierge.tokyo." + parent), namehash("concierge." + parent))`; (11) verify: `simulateContract setText(dnsName(concierge.parent), "description", "x")` from the concierge must revert; (12) write `ens-bootstrap.output.json` with every address and tx hash, print the env block. Each step is idempotent where the chain allows (skip deploy when the predicted CREATE2 address already has code; `predictProxyAddress` from the docs).

`ens-smoke.ts`: against the configured env: register `smoke-<hhmm>` trip expiring in 30 min, write records, re-read, write a table record from the concierge, attempt `description` from the concierge (expect revert), renew by 10 min, print hashes as a markdown table for `docs/EVIDENCE.md`.

- [ ] **Step 1: Implement; `npm run typecheck`; do not run against Sepolia. Commit** `feat(scripts): ENSv2 bootstrap and Sepolia smoke (unexecuted, documented)`.

---

### Task 15: Docs, env, seed fixtures

**Files:** Create `docs/WORLD-DEBRIEF-IDKIT.md`, `docs/WORLD-DEBRIEF-AGENTS.md`, `docs/EVIDENCE.md`, `src/server/ens-world/concierge/README.md` (Task 10), root `README-INTEGRATION.md` and `AGENT-MERGE-GUIDE.md` (written in Task 17 against the final diff). Modify `.env.example` (spec 9.1 block minus `ENS_DEFAULT_RECORD_ID`, plus `WORLD_ENVIRONMENT=staging`, `CONCIERGE_BRAIN=rules`, `SPLIT_OGPAY_ENABLED=false`), `docs/API.md` (new route tables), `docs/INTEGRATIONS.md` (replace the ENSv2 section's "Not complete" list with what is now implemented and what remains: bootstrap unexecuted, live evidence; add a World section), `README.md` ("What is implemented" bullets, routes table rows for `/tokyo/tables`, `/tokyo/tables/:id`, `/approvals/:id`; "What is not finished" item for live Sepolia/World evidence), `src/server/db/seed.ts` (demo trips for Maya and Kenji with active status through the simulated chain when `isDemo()`: call `activateTrip`-equivalent seeding function `seedEnsWorldDemo(db)` exported from `src/server/ens-world/seed.ts` and invoked from `db/index.ts` after `seedDemoContent`; Kenji hosts an open dinner at "Table for Tomorrow" tonight 19:00 JST for 6), `src/server/secrets.ts` (allow `ENS_OPERATOR_PRIVATE_KEY`, `ENS_CONCIERGE_PRIVATE_KEY`, `WORLD_RP_SIGNING_KEY`, `WORLD_AGENTS_CLIENT_SECRET` in the Secret Manager allowlist).

Debrief templates carry the sections the prize requires (time to first success, friction, missing capability or docs, the one improvement) with what is known now (sandbox callbacks refuse localhost; proofs mocked; `hashSignal` exists; `max_age` not listed in discovery) and `[fill after live run]` markers only where a live run is the only source.

- [ ] **Step 1: Write, `npm run format`, `npm test` (seed change must keep 44 + new tests green), commit** `docs: World debriefs, evidence template, API and integration docs, demo fixtures`.

---

### Task 16: Verification pass

- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run format:check`, `npm run smoke`, `npm audit --audit-level=high`.
- [ ] Browser click-through of spec section 10 in `npm run demo` (steps 1 to 7 with simulated adapters; step 8 by editing `departs_at` is covered by the test).
- [ ] Fix anything found; commit `test: verification pass for the ENSv2 + World drop`.

---

### Task 17: Export the drop

- [ ] `git format-patch main..ens-world -o <scratch>/ens-world-drop/patches/`; `git bundle create <scratch>/ens-world-drop/ens-world.bundle main..ens-world`.
- [ ] Build `<scratch>/ens-world-drop/` in the spec section 11 layout: copy every new file at its repo path; for each modified file write `<path>.patch` from `git diff main...ens-world -- <path>`; `.env.example.additions` = the added lines.
- [ ] Write `AGENT-MERGE-GUIDE.md` (for Alex's agent: base commit, three merge routes in order of preference (bundle fetch, `git am` the series, loose files + patches), the exact list of modified files with hunk summaries, env to add, commands to verify, the drizzle journal gap, the optional Bell patch, what is simulated vs live, what the owner must do before judging: register `<parent>.eth`, run bootstrap, register the World app and the sandbox OIDC client, deploy behind HTTPS, run smoke, fill evidence and debriefs) and `README-INTEGRATION.md` (one page for humans).
- [ ] Zip to `C:\Users\dan\Downloads\ens-world-drop.zip`; copy the drop folder to `C:\Users\dan\ClawdProjects\ens-world-drop\`.
