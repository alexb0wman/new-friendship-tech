# New Friendship Tech: ENSv2 + World integration spec

> Status 2026-09-26: this is the owner spec as written. Decisions taken during the build, and every deviation from this text, are recorded in `docs/ENS-WORLD-DESIGN.md`. Where the two disagree, the design addendum wins because it reflects what the code does. Continuity Track prizes mentioned below are out of scope (the project is a new build).

Hackathon: ETHGlobal Tokyo 2026. Target prizes: ENS "Best Use of ENSv2" (and the ENSv2 Continuity integration prize if the project is registered for Continuity), World "Best Use of IDKit", World "Best Use of World ID for Agents".

Audience: Claude Code (first build) and Alex (integration into `alexb0wman/new-friendship-tech`). Read alongside the repo's `README.md`, `AGENTS.md`, `docs/ARCHITECTURE.md` and `docs/INTEGRATIONS.md`. Nothing here overrides the repo's invariants; where this spec touches them it says so.

Pitch in one line: your Tokyo trip is a name, your concierge is a name with permissions, and every action that puts you in a room with a stranger is approved by a verified human.

---

## 1. Scope

### Level 1 (ship for the demo)

1. Trips as expiring, non-transferable ENSv2 subnames: `maya.tokyo.<parent>.eth`, expiry = departure date.
2. Tables (small meals: coffee, breakfast, lunch, dinner, drinks) as data-only ENS subnames with an on-chain attendee record: `ramen-0927.tables.tokyo.<parent>.eth`.
3. Join / approve flow for tables, including plus-ones and approving verified strangers when seats remain.
4. Pay record on the trip name and a split-the-bill flow that resolves each attendee's address from their name (0G Pay as the payment UI where it fits, plain wallet transfer as the fallback).
5. One concierge agent for the whole product, `concierge.<parent>.eth`, with exactly one scoped resolver permission (text keys `friendship.now` and `friendship.table`) and ENSIP-26 agent records.
6. World IDKit at trip activation: one human, one active trip; duplicate nullifier is the demonstrated failure path.
7. World ID for Agents: the concierge requests fresh human approval before any protected action; denied or expired approval means nothing is written.
8. Two integration debriefs (World requires them) and the ENS Etherscan evidence in the submission.

### Level 2 (design for, do not ship unless Level 1 is demoable end to end on Sepolia)

- Each city as a mounted subregistry (`seoul.<parent>.eth`), so launching a city = deploying a registry.
- Neighbourhood hierarchy under the city registry (`shibuya.tokyo.<parent>.eth`) holding places and events as data-only subnames.
- Contenthash on the trip name pointing at an IPFS itinerary.
- Per-member resolver instances so members can self-serve their own records without the shared-resolver scoping caveat (see 4.5).

### Out of scope

- Scoped curator / local host roles.
- Full events (ticketed, large). Tables only.
- Anything that moves the private contact graph on chain. Contacts stay encrypted in Postgres per the repo rules.
- Mainnet. Everything runs on Sepolia (ENSv2 beta) and World sandbox/staging.

---

## 2. Prize criteria mapped to features

### ENS: Best Use of ENSv2 ($3k / $2k / $1k)

Requirements: built on ENSv2 Sepolia, ENSv2 central not cosmetic, functional demo with no hardcoded values, live demo link, open source.

| Judge theme                                          | Where it shows up                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Registry hierarchy                                   | `<parent>.eth` → `tokyo` (UserRegistry) → trips (tokenised) and `tables` (data-only)              |
| Permissioned Registry, expiring / soulbound subnames | Trip registration with `expiry = departureAt` and a role bitmap without `ROLE_CAN_TRANSFER_ADMIN` |
| Permissioned Resolver, per-record roles              | Concierge wallet holds setter roles for two text keys only                                        |
| Record aliasing                                      | New trip names link to the default Tokyo record bundle until personalised                         |
| Agents as namespaces with delegated permissions      | `concierge.<parent>.eth` with ENSIP-26 `agent-context` and `agent-endpoint[mcp]`                  |
| Data-only subnames via resolver                      | Tables exist because records were written, no token minted                                        |

### World: Best Use of IDKit ($2.5k x 2)

Requirements: IDKit in a functioning app, at least one supported credential verified server-side, a clear explanation of the trust moment and why the credential is the minimum sufficient assurance, one successful verification plus one meaningful alternative path, and a written debrief.

Trust moment: activating a trip makes you publicly present in a city and lets you host or join tables with strangers. Minimum assurance: proof that you are one human (not identity, not nationality). Alternative paths: widget cancelled, credential unavailable, nullifier already bound to another active trip.

### World: Best Use of World ID for Agents ($2.5k x 2)

Requirements: integrate with the official World ID for Agents dev environment (sandbox), show the complete journey (request → user completes → validated result → protected action), show a denied / expired / cancelled path where the protected action does not occur, validate in a secure backend, and a written debrief. Sandbox proofs use fake identities; never rely on them in production.

Protected actions: publish `friendship.now`, send a table join request or intro, approve a stranger onto your table, reveal your contact to a match, claim a seat.

---

## 3. Name architecture (Sepolia, ENSv2 beta)

```
<parent>.eth                        ETHRegistry token, owned by operator wallet
├── concierge                       data-only; ENSIP-26 records; addr = concierge wallet
├── tokyo                           UserRegistry proxy (city registry), set via setSubregistry
│   ├── maya                        tokenised trip: owner = member wallet, expiry = departure, no transfer role
│   ├── kenji                       tokenised trip
│   └── tables                      data-only anchor; resolver = app resolver
│       ├── ramen-0927              data-only table (records only)
│       └── coffee-0928-0900        data-only table
└── (seoul, singapore)              Level 2: more city registries
```

Decisions:

- `<parent>` is whatever `.eth` label Alex registers on the Sepolia ETHRegistrar (MockUSDC fee, see 9.1). Store it in `ENS_PARENT_NAME`; never hardcode a name in code paths.
- Trips are tokenised because the token is the membership-style proof (owner = member's verified wallet) and expiry is enforced by the registry. Tables are data-only because they are cheap, numerous, and short-lived.
- Trip label = the member's normalised handle (ENSIP-15 via `viem/ens` `normalize`), unique per city while a trip is active. Collisions get a numeric suffix chosen by the server, never by the client.
- Table label = `<kind>-<MMDD>-<HHmm>` plus a short random suffix if needed. Kind ∈ {coffee, breakfast, lunch, dinner, drinks}.
- Do not store ERC-1155 token IDs anywhere. ENSv2 token IDs mutate on role changes. Store `labelhash`, canonical name, registry address and expiry.
- All Access stays global (repo rule). A trip is not an entitlement. Creating a trip requires an active All Access period; the trip may outlive the period, and then tables/joins are blocked by the existing membership gate while the name simply keeps resolving until expiry.

### 3.1 Records

Trip name (`maya.tokyo.<parent>.eth`), written by the operator wallet on the app resolver:

| Record                                                        | Value                                                          | Written by                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------- |
| `addr` (coinType 60)                                          | member's verified wallet                                       | operator, at registration                     |
| `addr` (0G chain, ENSIP-11 coinType = `0x80000000 + chainId`) | same or a chosen wallet                                        | operator, opt-in from settings ("pay record") |
| `text description`                                            | member's short bio (existing feature, keep wallet-signed path) | member or operator                            |
| `text avatar`                                                 | linked default until personalised                              | default bundle                                |
| `text friendship.trip`                                        | JSON `{ city, arrivesAt, departsAt, verifiedHuman: true }`     | operator                                      |
| `text friendship.now`                                         | JSON `{ kind, area, until }` or empty                          | concierge only                                |

Table name (`ramen-0927.tables.tokyo.<parent>.eth`), data-only:

| Record                  | Value               | Written by     |
| ----------------------- | ------------------- | -------------- |
| `text friendship.table` | JSON, schema in 6.3 | concierge only |

Concierge name (`concierge.<parent>.eth`):

| Record                     | Value                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `addr` (60)                | concierge wallet                                                                             |
| `text agent-context`       | Markdown: what it does, how to talk to it, which keys it may write, link to the MCP endpoint |
| `text agent-endpoint[mcp]` | `https://<app-origin>/api/mcp`                                                               |
| `text agent-endpoint[web]` | `https://<app-origin>/concierge`                                                             |

Default bundle (record linked to newly registered trips until the member personalises): `avatar` = city artwork, `url` = app origin, `description` = "Travelling with New Friendship Tech".

---

## 4. ENSv2 contract plan

Package: `@ensdomains/contracts-v2` (ABIs). Library: `viem` (already in the repo). Addresses come from the Deployments page, Sepolia ENSv2 beta section; put them in `src/server/ens-v2/addresses.ts` with a comment that they are beta and may change:

| Contract                    | Sepolia address                              |
| --------------------------- | -------------------------------------------- |
| RootRegistry                | `0x9703dbd26dab89504490994138cf2c575251a9ce` |
| ETHRegistry                 | `0x657ea849311d3d5823348dded7c2aaafb3ede09e` |
| ETHRegistrar                | `0xabe76f6c8dfced81aa5a2bb8034202a7136b94ca` |
| VerifiableFactory           | `0x9e726eb570beb6bceb495ab8cda7df517d4e841c` |
| UserRegistryImpl            | `0xa80338aaa8d23831cea25e858d1774534abb0263` |
| PermissionedResolverImpl    | `0x14f09fd05d4585759e54844dc9b00147131cf243` |
| UniversalResolverV2         | `0x5d25c1d6acbb71b7a28aa7899618a3412a8303e3` |
| MockUSDC (registration fee) | `0x16f95d91dba7da3aca778ec053df0ff6c6a8aa8e` |

Do not hardcode a Universal Resolver into resolution calls; viem's Sepolia chain config resolves through the canonical proxy (`0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe`). Re-check the Deployments page on build day; the beta redeploys.

### 4.1 One-off bootstrap (script `scripts/ens-bootstrap.ts`, run by the operator wallet)

1. Register `<parent>.eth` on ETHRegistrar (or do it in the ENS Sepolia manager UI). Fee is MockUSDC; the script mints/approves test USDC if a faucet function exists, otherwise do it by hand and record the tx.
2. Deploy the app resolver via `VerifiableFactory.deployProxy(PermissionedResolverImpl, salt, initData)` where `initData = initialize([{ account: operator, roleBitmap: ALL_ROLES }], [])`. Salt = `keccak256(abi.encode(keccak256("OwnedResolver"), operator, version))`. Read `ProxyDeployed.proxyAddress`.
3. Deploy the Tokyo city registry via `VerifiableFactory.deployProxy(UserRegistryImpl, salt, initData)` where `initData = initialize([{ account: operator, roleBitmap: ALL_ROLES }])`. The bitmap must include `ROLE_REGISTRAR_ADMIN` and `ROLE_RENEW_ADMIN`. Salt = `keccak256(abi.encode(keccak256("UserRegistry"), namehash("tokyo.<parent>.eth"), version))`.
4. The city sits one level below the parent, so the parent needs its own registry first. Deploy a parent registry with the step 3 pattern (salt on `namehash("<parent>.eth")`), then `ETHRegistry.setSubregistry(labelId("<parent>"), parentRegistry)` (you hold `ROLE_SET_SUBREGISTRY` from registering the name), then `parentRegistry.register("tokyo", operator, cityRegistry, appResolver, OWNER_BITMAP, farFutureExpiry)`. That produces the tree in section 3: parent registry holds `tokyo` and `concierge`, the city registry holds trips and `tables`.
5. On the city registry: `grantRootRoles(ROLE_REGISTRAR | ROLE_RENEW, operator)` (operator is the registrar in v1; a separate registrar contract is Level 2).
6. On the city registry: `register("tables", operator, IRegistry(0), appResolver, OWNER_BITMAP, farFutureExpiry)` so `tables.tokyo.<parent>.eth` resolves through the app resolver and data-only children resolve by wildcard.
7. On the app resolver: `grantSetterRoles(setter(ROLE_SET_TEXT, "friendship.now"), conciergeWallet)` and the same for `friendship.table`. Verify with a simulated `setText` for a different key from the concierge wallet: it must revert.
8. On the parent registry: `register("concierge", operator, IRegistry(0), appResolver, OWNER_BITMAP, farFutureExpiry)`; set `addr` and the ENSIP-26 text records.
9. Create the default record bundle on the app resolver and note its record id.
10. Write all resulting addresses and tx hashes to `ens-bootstrap.output.json` (committed, it is the judge evidence) and to `.env`.

Exact function names (`grantRootRoles`, `grantSetterRoles`, `setSubregistry`, `register`, `renew`, `linkToRecord`, `setText`, `setAddress`) follow the ENSv2 docs at the time of writing; read the ABI in `@ensdomains/contracts-v2` before calling and adjust names, not intent.

### 4.2 Role bitmaps

```
TRIP_OWNER_BITMAP = ROLE_SET_RESOLVER | ROLE_SET_RESOLVER_ADMIN
  // deliberately omits ROLE_CAN_TRANSFER_ADMIN (soulbound)
  // deliberately omits ROLE_SET_SUBREGISTRY (no sub-trips in v1)

OWNER_BITMAP (operator-owned anchors) = ROLE_SET_SUBREGISTRY | ROLE_SET_SUBREGISTRY_ADMIN
  | ROLE_SET_RESOLVER | ROLE_SET_RESOLVER_ADMIN | ROLE_CAN_TRANSFER_ADMIN
```

Take the constant values from `RegistryRolesLib` in the package, never from memory. `ROLE_REGISTRAR = 1 << 0`, `ROLE_RENEW = 1 << 16` per the docs, but verify.

### 4.3 Trip lifecycle on chain

- Create: `cityRegistry.register(label, memberWallet, IRegistry(0), appResolver, TRIP_OWNER_BITMAP, departsAt)`; then `appResolver.setAddress(tripName, 60, memberWallet)`, `setText(tripName, "friendship.trip", json)`, `linkToRecord(tripName, DEFAULT_RECORD_ID)` for the avatar/url/description bundle. Expiry is an absolute Unix timestamp.
- Extend: `cityRegistry.renew(labelId, newDepartsAt)`; the registry enforces `newExpiry >= oldExpiry`, so shortening a trip is off-chain only (mark ended in Postgres, leave the name to expire).
- End early: optional `unregister(labelId)` by operator (`ROLE_UNREGISTER` at root). Skip for the demo unless trivial.
- After expiry the label becomes available again; the app must treat an expired name as gone and let the member register a new trip.

### 4.4 Table lifecycle on chain

- Create: concierge wallet `setText("ramen-0927.tables.tokyo.<parent>.eth", "friendship.table", json)`. No registry call. The name resolves through the `tables` anchor's resolver by wildcard.
- Update (seat approved, attendee added, cancelled): concierge rewrites the same record.
- Close: concierge writes `status: "closed"` then, after the split is done or 24h passes, sets the record to an empty string.
- Every write is proven the way the repo already proves `description` writes (`ens-proof.ts`): prepare intent → send → receipt → re-read the record → compare. Reuse `assertENSWriteProof` with the key parameterised.

### 4.5 Known caveat: shared resolver scoping

Permissioned Resolver roles are per record type/key across every name served by that resolver instance, not per name. So the concierge's `friendship.now` role covers every trip on the app resolver. That is the intended v1 story ("one agent, one key, all members, nothing else"). It also means members cannot be granted self-service write roles on the shared resolver without gaining them on everyone's names. Member-authored records therefore go through the operator wallet after Privy auth in v1. Level 2 fixes this by deploying one resolver proxy per trip (cheap via factory) and granting the concierge its setter role on each. Say this out loud in the README; judges will ask.

---

## 5. World integration

### 5.1 IDKit at trip activation

Packages: `@worldcoin/idkit` (React, v4). Server verification: `POST https://developer.world.org/api/v4/verify/{rp_id}` with the IDKit payload forwarded as-is.

- Developer Portal: create the app, create action `trip-activate` (one proof per human per action per signal; see below). Record `WORLD_APP_ID`, `WORLD_RP_ID` and the RP signing key for `rp_context`.
- Widget: `IDKitRequestWidget` with `app_id`, `action: "trip-activate"`, `signal: <cityId>` and preset `proofOfHuman()`; offer `passport()` as the second button for the Orb-free path. `rp_context` (rp_id, nonce, timestamps, signature) is generated server-side per request via `GET /api/world/rp-context` and never in the browser.
- Uniqueness rule: the nullifier is derived from (World ID, app, action). We want one human = one active trip per city, so `signal = cityId` and the nullifier is stored with `cityId`. A second activation attempt with the same nullifier while a trip is active is rejected with `HUMAN_ALREADY_PRESENT`. After the trip expires, the same nullifier may activate a new trip.
- Storage: `human_proofs.nullifier NUMERIC(78,0)` unique per `(action, city)`, plus `issuer_schema_id`, `expires_at_min`, `verified_at`, `user_id`. Store nothing else from the proof.
- Server flow: widget `handleVerify` → `POST /api/world/verify` → forward to World → on success insert nullifier row inside the same transaction that enqueues the ENS trip registration → return `{ ok, tripId }`. Any error from World → `WORLD_VERIFY_FAILED` and no trip.
- Failure paths to demo: (a) user closes the widget (`onError`/cancel → toast, no trip), (b) duplicate nullifier (`HUMAN_ALREADY_PRESENT`, UI explains one active trip per human), (c) credential unavailable (World returns an error; UI offers the alternative credential).
- Human badge: `users.verified_human_at` set on first success; profiles and table attendee lists show "Verified human". Unverified members can browse and save; they cannot activate a trip, host a table, or join one.

### 5.2 World ID for Agents (sandbox)

The concierge is an OIDC client in the World ID for Agents sandbox (`https://sandbox.auth.world.org/portal`; MCP helper at `/mcp`; iOS sandbox app via TestFlight). Standards: OIDC authorization code + PKCE (S256), pairwise `sub`, RFC 9470 step-up freshness, RS256 ID tokens.

- Link once: from Settings, "Let the concierge act for you" starts the authorization code flow. Store `(issuer, sub)` on the user. This is the persistent connection.
- Step-up per protected action: the concierge (server) creates an `agent_approvals` row `{ id, userId, action, payload, status: pending, expiresAt: now + 2 min }`, then starts a fresh authentication request with a freshness requirement (`max_age=0` or the sandbox's step-up parameter per its discovery document) and returns the approval link / QR to the member. The member completes it in the sandbox app.
- Validate: on callback, verify the ID token signature against JWKS, check `iss`, `aud`, `sub` equals the stored sub, `auth_time` within the window, `nonce` matches the approval row. Only then mark the row `approved` and execute the action. The client never carries authorization; a browser callback is a hint, consistent with the repo's payments rule.
- Protected actions in v1: `now.publish` (write `friendship.now`), `table.request` (ask to join), `table.approve` (host approves an attendee), `table.claim` (seat confirmed and attendee written on chain), `contact.reveal` (existing mutual reveal, now agent-initiated). Each executes exactly one downstream effect and is idempotent on `approvalId`.
- Failure paths to demo: (a) member declines in the app → `denied`, nothing written, (b) approval expires after 2 minutes → `expired`, nothing written, (c) token replay with a used nonce → rejected, audit row.
- Keep sandbox identities and IDKit identities separate in the schema. Never treat a sandbox `sub` as proof of humanity.

### 5.3 Debriefs (required by both World prizes)

`docs/WORLD-DEBRIEF-IDKIT.md` and `docs/WORLD-DEBRIEF-AGENTS.md`, each answering: time to first success, friction encountered, missing capability or documentation, and the one improvement with the greatest impact. Fill them in as you build, not at the end.

---

## 6. Data model (Drizzle, new migration `000X_trips_tables_world.sql`)

Do not edit applied migrations. Postgres stays authoritative; chain state mirrors it.

### 6.1 `trips`

| column                 | type            | notes                                                                           |
| ---------------------- | --------------- | ------------------------------------------------------------------------------- |
| id                     | uuid pk         |                                                                                 |
| user_id                | fk users        | one active trip per user per city (partial unique index on `status = 'active'`) |
| city                   | text            | `tokyo` in v1                                                                   |
| label                  | text            | normalised handle, unique per city while active                                 |
| ens_name               | text            | full name                                                                       |
| labelhash              | bytea/text      |                                                                                 |
| registry               | text            | city registry address                                                           |
| arrives_at, departs_at | timestamptz     | departs_at = on-chain expiry                                                    |
| status                 | enum            | `pending_human`, `pending_chain`, `active`, `ended`, `expired`, `failed`        |
| chain_tx               | text            | registration tx hash                                                            |
| chain_verified_at      | timestamptz     | after receipt + re-resolve                                                      |
| human_proof_id         | fk human_proofs |                                                                                 |
| created_at, updated_at |                 |                                                                                 |

### 6.2 `human_proofs`

| column           | type          | notes                                                     |
| ---------------- | ------------- | --------------------------------------------------------- |
| id               | uuid pk       |                                                           |
| user_id          | fk users      |                                                           |
| action           | text          | `trip-activate`                                           |
| city             | text          |                                                           |
| nullifier        | numeric(78,0) | unique `(action, city, nullifier)` while a trip is active |
| issuer_schema_id | text          |                                                           |
| expires_at_min   | timestamptz   |                                                           |
| verified_at      | timestamptz   |                                                           |

### 6.3 `gatherings` (tables; avoid the SQL word)

| column                 | type          | notes                                    |
| ---------------------- | ------------- | ---------------------------------------- |
| id                     | uuid pk       |                                          |
| host_user_id           | fk users      | must have an active trip                 |
| trip_id                | fk trips      |                                          |
| city                   | text          |                                          |
| kind                   | enum          | coffee, breakfast, lunch, dinner, drinks |
| place_slug             | text nullable | links to catalog place                   |
| area                   | text          | neighbourhood string                     |
| starts_at              | timestamptz   |                                          |
| seats                  | int           | including host; 2..8                     |
| label, ens_name        | text          |                                          |
| status                 | enum          | `open`, `full`, `closed`, `cancelled`    |
| split_status           | enum          | `none`, `pending`, `settled`             |
| chain_record_tx        | text          | last concierge write                     |
| created_at, updated_at |               |                                          |

On-chain `friendship.table` JSON (kept under 1 KB):

```json
{
  "v": 1,
  "kind": "dinner",
  "place": "fuglen.shibuya",
  "area": "Shibuya",
  "startsAt": 1790000000,
  "seats": 6,
  "host": "maya.tokyo.<parent>.eth",
  "attendees": ["kenji.tokyo.<parent>.eth", "maya.tokyo.<parent>.eth"],
  "guests": 1,
  "status": "open",
  "expiresAt": 1790021600
}
```

Attendees are ENS names, never account IDs or wallets. Guests (plus-ones) are a count only.

### 6.4 `gathering_attendees`

| column       | type                        | notes                                       |
| ------------ | --------------------------- | ------------------------------------------- |
| id           | uuid pk                     |                                             |
| gathering_id | fk                          |                                             |
| user_id      | fk users                    |                                             |
| trip_id      | fk trips                    |                                             |
| role         | enum                        | `host`, `member`                            |
| plus_ones    | int                         | 0 or 1 in v1                                |
| status       | enum                        | `requested`, `approved`, `declined`, `left` |
| approval_id  | fk agent_approvals nullable | the World step-up that admitted them        |
| share_cents  | int nullable                | set at split                                |
| paid_tx      | text nullable               |                                             |

### 6.5 `agent_approvals`

| column      | type        | notes                                                                            |
| ----------- | ----------- | -------------------------------------------------------------------------------- |
| id          | uuid pk     |                                                                                  |
| user_id     | fk users    |                                                                                  |
| action      | text        | `now.publish`, `table.request`, `table.approve`, `table.claim`, `contact.reveal` |
| payload     | jsonb       | what will happen, shown to the human                                             |
| nonce       | text unique |                                                                                  |
| status      | enum        | `pending`, `approved`, `denied`, `expired`, `consumed`                           |
| world_sub   | text        | pairwise sub that approved                                                       |
| auth_time   | timestamptz |                                                                                  |
| expires_at  | timestamptz |                                                                                  |
| consumed_at | timestamptz |                                                                                  |

### 6.6 `ens_jobs`

Reuse the payments worker shape (lease, backoff, attempts, review state). `kind` ∈ `trip.register`, `trip.renew`, `record.set`, `table.write`. `signer` ∈ `operator`, `concierge`. Store prepared calldata, tx hash, receipt status, re-read value and verified_at. Twelve attempts then `review`, same as invoices.

### 6.7 `users` additions

`verified_human_at timestamptz`, `world_agent_issuer text`, `world_agent_sub text`.

---

## 7. Services and API

All handlers are framework-independent Web Request handlers under `src/server/`, routed by `src/server/router.ts`, exactly like the existing ones. Every mutation goes through `applyWrite` for audit.

### 7.1 `src/server/ens-v2/`

- `addresses.ts`: Sepolia beta addresses + `ENS_PARENT_NAME` derived names.
- `clients.ts`: public client (reuse `client()` from `ens.ts`), operator wallet client, concierge wallet client. Two keys, two env vars, loaded through the existing Secret Manager loader in prod and `.env` locally.
- `names.ts`: label normalisation, `tripName(city, label)`, `tableName(city, label)`, `labelId`.
- `registry.ts`: `registerTrip`, `renewTrip`, `unregisterTrip` (prepare calldata, submit via job).
- `resolver.ts`: `setText`, `setAddress`, `linkDefaultRecord`, `readText`, `readAddr`, `readTableRecord`, `readNowRecord`; reads go through the Universal Resolver via viem (`getEnsText`, `getEnsAddress`), never through a hardcoded resolver.
- `jobs.ts`: worker handlers for `ens_jobs`, each ending with receipt check + fresh re-read + `assertENSWriteProof`-style comparison.
- `bootstrap.ts`: the one-off script logic used by `scripts/ens-bootstrap.ts`.

### 7.2 `src/server/world/`

- `idkit.ts`: `rpContext()` (server-signed), `verifyProof(payload)` → forwards to World, returns `{ nullifier, issuerSchemaId, expiresAtMin }`.
- `agents.ts`: OIDC client (discovery, PKCE, JWKS cache), `startLink(user)`, `finishLink(code)`, `requestApproval(user, action, payload)`, `finishApproval(callback)`, `assertApproved(approvalId, action, user)`.

### 7.3 `src/server/trips.ts`

- `activateTrip(user, { city, arrivesAt, departsAt, idkitPayload })`: requires active All Access; verifies proof; enforces one active trip per user and per nullifier; picks label; inserts trip `pending_chain`; enqueues `trip.register`. Returns trip with `status`.
- `extendTrip`, `endTrip`, `myTrip`, `tripByName` (public: name → `{ active, departsAt, verifiedHuman }`, no account data).
- Worker completion flips `active`, stores tx, re-resolves `addr` and `friendship.trip` and compares before marking `chain_verified_at`.

### 7.4 `src/server/gatherings.ts`

- `createGathering(host, body)`: host has active trip and verified human; label; insert `open`; enqueue `table.write` (concierge signer) with the JSON.
- `requestSeat(user, gatheringId, plusOnes)`: user has active trip + verified human; not blocked (reuse `blockedIds`); seats available; creates approval `table.request`; only after approval is consumed does the row become `requested` and the host gets notified.
- `approveSeat(host, attendeeId)`: creates approval `table.approve` for the host; on consumption sets `approved`, recomputes `status` (`full` when seats reached), enqueues `table.write`.
- `declineSeat`, `leaveGathering`, `cancelGathering`, `listGatherings(city)` (open tables, host name, seats left, place), `gatheringDetail`.
- `closeGathering(host)` → `closed`, enqueue final write.

### 7.5 `src/server/split.ts`

- `startSplit(host, gatheringId, totalCents, currency)`: computes equal shares across approved attendees (host covers guests' shares); resolves each attendee's pay `addr` from their trip name at that moment (fresh resolution, same as `lookupMemberByENS`), stores `share_cents` and the resolved address snapshot; returns payment instructions per attendee.
- Payment: attendee pays host from their own wallet. UI mounts 0G Pay's `OgPayTrigger` with the resolved recipient and amount when `SPLIT_OGPAY_ENABLED=true`; otherwise a plain `sendTransaction` on Sepolia. This is peer-to-peer, not the app's merchant checkout, so the closed 0G merchant adapter rule in `INTEGRATIONS.md` is untouched. The browser reports a tx hash as a hint; the worker verifies recipient, amount and success from the chain before marking `paid_tx`.
- `settled` when every non-host attendee has a verified `paid_tx`.

### 7.6 `src/server/concierge/`

- `agent.ts`: server-side agent loop (Claude API or any provider; env `CONCIERGE_MODEL`). Tools: `listOpenTables(city)`, `whoIsAround(city)` (trip names + `friendship.now` only), `suggestTable(user)`, `draftInvite`, `publishNow(user, payload)` (creates `now.publish` approval), `writeTableRecord(gatheringId)`. Every tool that changes state requires an approval id; the tool refuses without one.
- `mcp.ts`: minimal MCP server at `/api/mcp` exposing read-only tools `resolveTrip(name)`, `openTables(city)`, `whoIsAround(city)`. This is the endpoint published in `agent-endpoint[mcp]`. Read-only in v1, no auth beyond rate limiting.
- The concierge signs on-chain writes with its own wallet, which is the whole point: the scoped role is real and a write to any other key reverts.

### 7.7 Routes

| Method | Path                             | Handler                                       |
| ------ | -------------------------------- | --------------------------------------------- |
| GET    | `/api/world/rp-context`          | idkit.rpContext                               |
| POST   | `/api/world/verify`              | trips.activateTrip (proof inside body)        |
| GET    | `/api/world/agent/link`          | agents.startLink                              |
| GET    | `/api/world/agent/callback`      | agents.finishLink / finishApproval (by state) |
| GET    | `/api/trips/me`                  | trips.myTrip                                  |
| POST   | `/api/trips/extend`              | trips.extendTrip                              |
| POST   | `/api/trips/end`                 | trips.endTrip                                 |
| GET    | `/api/trips/:name`               | trips.tripByName (public, rate limited)       |
| GET    | `/api/gatherings?city=`          | gatherings.list                               |
| POST   | `/api/gatherings`                | gatherings.create                             |
| GET    | `/api/gatherings/:id`            | gatherings.detail                             |
| POST   | `/api/gatherings/:id/request`    | gatherings.requestSeat                        |
| POST   | `/api/gatherings/:id/approve`    | gatherings.approveSeat                        |
| POST   | `/api/gatherings/:id/decline`    | gatherings.declineSeat                        |
| POST   | `/api/gatherings/:id/close`      | gatherings.close                              |
| POST   | `/api/gatherings/:id/split`      | split.startSplit                              |
| POST   | `/api/gatherings/:id/split/paid` | split.reportPayment (hint only)               |
| POST   | `/api/concierge/now`             | concierge publishNow (returns approval link)  |
| POST   | `/api/concierge/chat`            | agent.turn                                    |
| GET    | `/api/approvals/:id`             | agent_approvals status (polling)              |
| ANY    | `/api/mcp`                       | mcp server                                    |

Existing `ens/link`, `ens/lookup`, `ens/description`, `ens/confirm` stay. `ens/lookup` should also accept trip names.

---

## 8. UI

Keep the existing design system (dark editorial, lime actions) and screens. Additions:

- Onboarding / Settings: "Your trip" card. Arrival and departure dates, activate button that opens IDKit, state machine copy for `pending_human` → `pending_chain` (with Etherscan link) → `active` (name shown as `maya.tokyo.<parent>.eth`, expiry date, "Verified human" badge). Denied and duplicate states with plain copy.
- Settings: "Pay record" toggle (writes the 0G / ETH `addr`), "Let the concierge act for you" (World agents link), concierge name shown with its two permitted keys spelled out.
- `/tokyo/tables` (new tab next to Right now): list of open tables with kind, place, time, seats left, host name and badge; "Host a table" form; each card shows the on-chain record link.
- Table detail: attendees as names with badges, plus-one count, request / approve / decline, the approval QR/link modal with a live status poll and explicit denied/expired states, close, split panel with per-attendee share and pay button, settled state.
- People and member cards: show trip name and `friendship.now` if present; "Right now" composer becomes "Ask the concierge to post it", which triggers the approval flow.
- Concierge chat drawer: three canned prompts ("who's around tonight", "find me a dinner", "post that I'm free for coffee until 6"), every state-changing suggestion ends in an approval link.
- Anywhere an address is shown, show the name (Kevin's credo). Sepolia badge stays.

---

## 9. Configuration and operations

### 9.1 Environment

```
ENS_ENABLED=true
ENS_WRITE_ENABLED=true
ENS_SEPOLIA_RPC_URL=
ENS_PARENT_NAME=<label>.eth
ENS_PARENT_REGISTRY=0x...
ENS_CITY_REGISTRY_TOKYO=0x...
ENS_APP_RESOLVER=0x...
ENS_DEFAULT_RECORD_ID=
ENS_OPERATOR_PRIVATE_KEY=        (Secret Manager in prod)
ENS_CONCIERGE_PRIVATE_KEY=       (Secret Manager in prod, different key)
WORLD_APP_ID=
WORLD_RP_ID=
WORLD_RP_SIGNING_KEY=
WORLD_ACTION_TRIP=trip-activate
WORLD_AGENTS_ISSUER=https://sandbox.auth.world.org
WORLD_AGENTS_CLIENT_ID=
WORLD_AGENTS_CLIENT_SECRET=
WORLD_AGENTS_REDIRECT_URI=
CONCIERGE_MODEL=
CONCIERGE_API_KEY=
SPLIT_OGPAY_ENABLED=false
```

Demo mode (`npm run demo`) must keep working without any of these: trips, tables and approvals run against a `SimulatedChain` and `SimulatedWorld` adapter behind the same service interfaces, clearly labelled in the green demo strip, never in production. Follow the existing pattern in `payments/adapter.ts`.

### 9.2 Wallets and funding

Two Sepolia wallets: operator (registrar + resolver admin) and concierge (setter roles only). Fund both with Sepolia ETH. Never reuse the concierge key anywhere else; its narrowness is the demo.

### 9.3 Tests

- Domain: label rules, one-active-trip constraints, seat maths, split shares with guests, approval state machine, nullifier uniqueness per city, expiry handling.
- API (PGlite like the existing suite): activate trip happy path and all three failure paths; request/approve/claim with approval consumed exactly once; table JSON round-trip; split with hints ignored until chain verification.
- Proof tests: extend `ens-proof` tests to arbitrary keys and to the concierge signer, including the negative case (concierge writing `description` must fail at simulation).
- One live smoke script `scripts/ens-smoke.ts` that, against Sepolia, registers a throwaway trip, writes a table record from the concierge, attempts a forbidden write from the concierge (expects revert), and prints all tx hashes. Run it once before recording the demo and commit the output.

---

## 10. Demo script (about three minutes)

1. Maya lands in Tokyo. Settings → set dates → Activate. IDKit opens, she proves she is one human, the trip name appears with a pending chain state, then flips active with the Etherscan link. Show the resolved name in the ENS explorer: expiry equals her departure.
2. Try to activate again from a second account with the same World ID: `HUMAN_ALREADY_PRESENT`. Failure path one.
3. Kenji hosts a dinner at Fuglen for six. The table name resolves; the concierge wrote the record from its own wallet. Show the tx and the resolver record.
4. Maya asks the concierge "who's around tonight". It suggests Kenji's dinner. She asks to join: approval request appears in the World sandbox app, she approves, the request lands. Kenji approves her: his own step-up, then the attendee list on chain updates.
5. A third member requests and declines the step-up: `denied`, the record does not change. Failure path two. Let one expire: `expired`. Failure path three.
6. Show the concierge attempting to write `description` on a trip: revert. Permissions are real.
7. After dinner Kenji taps split. Shares resolve to pay records on names, Maya pays with 0G Pay (or a wallet transfer), the worker verifies, table settles.
8. Departure day: the trip name expires on its own.

Record each on-chain step with a hash; put them in the submission and in `docs/EVIDENCE.md`.

---

## 11. Handoff packaging for Alex

Deliver a zip with this layout so it drops onto the repo with minimal merging:

```
ens-world-drop/
  README-INTEGRATION.md          what changed, in which order to merge, env to add
  drizzle/000X_trips_tables_world.sql
  drizzle/meta/...               regenerate with drizzle-kit, do not hand edit
  src/server/ens-v2/*
  src/server/world/*
  src/server/concierge/*
  src/server/trips.ts
  src/server/gatherings.ts
  src/server/split.ts
  src/server/router.ts.patch     new routes only
  src/server/db/schema.ts.patch  new tables + users columns
  src/server/db/seed.ts.patch    demo trips/tables for Alex, Maya, Host
  src/components/views/tables.tsx
  src/components/views/trip-card.tsx
  src/components/concierge-drawer.tsx
  src/components/approval-modal.tsx
  src/components/views/account.tsx.patch
  src/components/views/people.tsx.patch
  scripts/ens-bootstrap.ts
  scripts/ens-smoke.ts
  tests/trips.test.ts
  tests/gatherings.test.ts
  tests/world.test.ts
  docs/ENS-WORLD-SPEC.md         this file
  docs/WORLD-DEBRIEF-IDKIT.md
  docs/WORLD-DEBRIEF-AGENTS.md
  docs/EVIDENCE.md               tx hashes, addresses, screenshots list
  .env.example.additions
```

Rules for the drop, inherited from the repo:

- Do not replace the service layer with client state. Browser callbacks are hints.
- Do not use a name or wallet as the account ID. `users.id` stays primary; trips reference it.
- Do not expose contacts through profiles, logs, ENS records or unauthenticated APIs. Table records carry names only.
- Keep demo mode local and simulated; production rejects it.
- Update source, tests and migration together for anything touching money, identity or social authorization (all of this does).
- Use the Next version shipped in `node_modules/next/dist/docs/` for framework conventions.

---

## 12. Decisions still open (ask Alex before building the affected part)

1. Parent label to register on Sepolia (`<parent>.eth`). Affects nothing in code, everything in the demo copy.
2. Is the project registered in the Continuity Track? If yes, add the ENS integration prize and both World continuity prizes to the submission with the same build.
3. 0G Pay for the split: mount `OgPayTrigger` for peer-to-peer on Sepolia/testnet, or keep the wallet transfer and mention 0G in the roadmap. Depends on whether the 0G testnet route can target an arbitrary recipient with a fixed amount. Default: wallet transfer, 0G behind the flag.
4. Concierge model provider and key.
5. Whether members' `description` edits keep the wallet-signed path (works only if the member wallet has a role on the shared resolver, which we are not granting) or move to the operator-written path. Default: operator-written in v1, note the Level 2 per-trip resolver fix.
6. Plus-one cap (default 1) and seat cap (default 8).
