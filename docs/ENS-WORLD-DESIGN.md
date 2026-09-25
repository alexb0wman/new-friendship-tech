# ENSv2 + World drop: design addendum

Companion to `docs/ENS-WORLD-SPEC.md`. The spec says what to build; this file records the decisions taken while building it and every place the build deviates from the spec, with the reason. Read both before merging. Written 2026-09-26 for ETHGlobal Tokyo 2026.

Prize scope (confirmed with the project owner): ENS "Best Use of ENSv2" (new build track), World "Best Use of IDKit", World "Best Use of World ID for Agents". The project is not in the Continuity Track; the continuity prizes named in the spec are out of scope.

---

## 1. Decisions taken

| Topic | Decision | Why |
|---|---|---|
| ENSv2 ABIs | Hand-written minimal viem ABIs in `src/server/ens-v2/abi.ts` | `@ensdomains/contracts-v2` is a Foundry git dependency, not an npm package. Minimal ABIs keep the drop dependency-free and are copied verbatim from the ENSv2 docs function signatures. |
| Chain access | `ChainAdapter` interface with two implementations: `SepoliaChain` (viem, two wallet clients) and `SimulatedChain` (in-memory, role scoping enforced) | Mirrors the repo's `payments/adapter.ts` pattern. Demo mode and the test suite never touch an RPC. |
| World access | `WorldAdapter` interface with `WorldLive` and `SimulatedWorld` | Same reason. The sandbox OIDC callback must be a public HTTPS URL, so the agent flow cannot run against localhost at all. |
| Concierge brain | `ConciergeBrain` interface, `RuleBrain` shipped (deterministic), no LLM dependency | The project owner runs inference on his own low-cost stack (0G compute). The agent loop, tools and approval plumbing are provider-agnostic; plugging a model in is one class. |
| Migration | Hand-written `drizzle/0003_trips_tables_world.sql`, no `drizzle/meta` regeneration | The repo's own `0002_content_items.sql` was hand-written and is absent from `drizzle/meta/_journal.json`. Regenerating meta would re-diff `content_items`. Follow the repo precedent and fix the journal gap in one go later (see merge guide). |
| Demo actors | Kenji (dinner host) and Ari (declines the step-up) added to the actor switcher | The demo script needs three humans plus a fourth who declines. Fixture data only. |
| Pre-existing typecheck error | `src/components/app-shell.tsx` references `Bell` without importing it; fixed in an optional standalone patch | `npm run typecheck` fails on `main` before this drop. The fix is one import line and is kept separate so it can be dropped if `main` has already fixed it. |
| Split settlement asset | MockUSDC on Sepolia (6 decimals, anyone can mint), amount = `share_cents * 10^4` | A USD-denominated share needs a USD-denominated asset; Sepolia ETH has no price. MockUSDC is the same token the ETH Registrar uses for registration fees, so the wallet already holds it. 0G Pay stays behind `SPLIT_OGPAY_ENABLED` exactly as the spec says. |
| MCP endpoint | Own Next route `src/app/api/mcp/route.ts`, hand-written JSON-RPC, read-only tools | The catch-all API route enforces an exact `Origin` header on every POST; MCP clients are server-to-server and send none. A separate route keeps that rule intact for the app API. No MCP SDK dependency. |
| Router integration | One call into `src/server/ens-world/router.ts` from the existing `handleApi`, plus a public-path predicate | Keeps the patch to `router.ts` to a handful of lines. All new routes live in the drop. |

---

## 2. Deviations from the spec, with reasons

### 2.1 Record aliasing moves from trips to the concierge

Spec section 3.1 links each new trip to a default record bundle (`linkToRecord(tripName, DEFAULT_RECORD_ID)`) for avatar, url and description.

Permissioned Resolver linking is bundle-level: a name serves either all of a record's values or none of them, and a write through a linked name mutates the shared record. A trip needs its own `addr` and `friendship.*` values from the moment it is registered, so linking it to a shared bundle would either overwrite the bundle for every trip or lose the defaults the moment the first personal record is written. The two cannot coexist on one name.

What ships instead:

- Trip registration writes `avatar`, `url` and `description` defaults as plain records on the trip's own bundle (operator wallet, same multicall as `addr` and `friendship.trip`). Constants live in `src/server/ens-v2/names.ts`, not in env.
- Record aliasing is demonstrated where it is honest: the concierge. `concierge.<parent>.eth` holds the ENSIP-26 records; `concierge.tokyo.<parent>.eth` is linked to that record with `linkToNode`, so the agent is reachable under every city namespace from one bundle. Launching a city (Level 2) adds one link, not a copy.
- `ENS_DEFAULT_RECORD_ID` is removed from the env list.

### 2.2 The `tokyo` entry and the parent name carry no resolver

Spec section 4.1 registers `tokyo` with the app resolver.

Resolution walks down the registry tree and uses the deepest resolver found. When a trip expires, its registry entry returns `address(0)` for both resolver and subregistry, so the walk falls back to the nearest ancestor resolver. If that ancestor is the shared app resolver, the expired trip keeps resolving because its record bundle still lives in the resolver. The expiry story would be false.

What ships instead:

- `tokyo.<parent>.eth` is registered with resolver `address(0)` and subregistry = city registry.
- `<parent>.eth` keeps whatever resolver the registration set; the bootstrap never points it at the app resolver.
- `tables.tokyo.<parent>.eth` and `concierge.*` are registered explicitly with the app resolver and a far-future expiry, so data-only children under `tables` and the concierge names resolve.
- Belt and braces: a `trip.expire` job clears the expired trip's records on the app resolver (operator holds root roles), so even a future resolver change cannot resurrect a stale trip.

Consequence: the bare city name `tokyo.<parent>.eth` does not resolve to anything. That is acceptable; nothing in the product resolves it.

### 2.3 World ID for Agents is OIDC, not a bespoke API

The sandbox at `https://sandbox.auth.world.org` publishes standard discovery metadata: authorization code flow, PKCE S256, `prompt` values `none` and `login`, pairwise `sub`, RS256 ID tokens with `auth_time`, `nonce`, `acr` and `amr` claims. There is no separate "approval" API; a step-up is a fresh authorization request with `prompt=login` (and `max_age=0`, the OIDC Core freshness parameter) whose ID token is validated for `auth_time`.

Concretely:

- Link: authorization request with `state = approvalId` (a row with `action = agent.link`), no freshness requirement. Callback stores `(iss, sub)` on the user.
- Step-up: authorization request with `state = approvalId`, `nonce = approval.nonce`, `prompt=login`, `max_age=0`. Callback verifies signature against JWKS, `iss`, `aud`, `nonce`, `sub` equals the stored sub, `auth_time >= approval.created_at - 60s`, then marks the row approved and executes the action inside the same transaction that marks it consumed.
- Denied: the OIDC error redirect (`error=access_denied`) marks the row denied. Expired: any callback after `expires_at` marks the row expired and executes nothing. Replay: a consumed row rejects a second callback and writes an audit row.
- Sandbox redirect URIs must be exact public HTTPS URLs; `http://localhost` is refused at registration. Registering the OIDC client requires a Google sign-in on the sandbox portal (`https://sandbox.auth.world.org/portal`), which only the project owner can do. `WORLD_AGENTS_CLIENT_ID` and `WORLD_AGENTS_CLIENT_SECRET` come from that registration.
- The prize page notes that proofs are currently mocked in the sandbox, so the sandbox World ID app is not required for judging. Nothing in this drop assumes a real World ID behind a sandbox `sub`.

### 2.4 IDKit v4 specifics

- `rp_context` is produced server-side by `signRequest` from `@worldcoin/idkit-core/signing` with `RP_SIGNING_KEY`. It is never generated in the browser.
- Widget: `IDKitRequestWidget` with `preset = proofOfHuman({ signal: city })`, `allow_legacy_proofs = true`, `environment` from `WORLD_ENVIRONMENT` (`staging` with the simulator during development, `production` otherwise). A second button offers `passport()` as the Orb-free path.
- Verification: forward the IDKit result unchanged to `POST https://developer.world.org/api/v4/verify/{rp_id}`, require `success`, require the response `environment` to equal `WORLD_ENVIRONMENT`, then store the nullifier as `NUMERIC(78,0)`.
- Signal binding: the backend records the `signal_hash` from the verified payload alongside the proof. Whether the backend can independently recompute the v4 signal hash for `city` depends on a helper exported by `idkit-core`; if none exists at build time the debrief records it as a missing capability and the check is `signal_hash` present and stable, not recomputed.
- Uniqueness rule: `action = trip-activate` for every city, so one human has one nullifier for the app. "One active trip per human per city" is enforced as: no trip in `pending_chain` or `active` for the same `(city, nullifier)`. After expiry the same nullifier activates again. Cross-city trips are allowed by design (Level 2).

### 2.5 Trip label

The repo has no handle field; users have a display name. Activation derives a suggestion from the first token of the name (ENSIP-15 normalised, `[a-z0-9-]`, 3 to 32 chars), the member may edit it, the server validates it and resolves collisions with a numeric suffix. The label is unique per city among `pending_chain` and `active` trips (partial unique index).

### 2.6 Concierge brain

`src/server/concierge/brain.ts` defines:

```ts
interface ConciergeBrain {
  respond(input: BrainInput): Promise<BrainOutput>;
}
// BrainInput: { user, city, message, context: { openTables, whoIsAround, myTrip } }
// BrainOutput: { reply: string; proposals: Proposal[] }
// Proposal: { action: ApprovalAction; payload: unknown; summary: string }
```

`RuleBrain` handles "who's around", "find me a dinner/lunch/coffee", and "post that I'm free for X until HH:MM" deterministically. `agent.ts` prefetches the read-only context, calls the brain, and turns proposals into approval requests. A model-backed brain implements the same interface and is selected by `CONCIERGE_BRAIN` (`rules` | `custom`); the custom loader is a single import point for the owner's inference stack.

### 2.7 Split shares

People at the table = approved attendees (host included) + plus-ones. `unit = ceil(total / people)`. Every non-host attendee owes `unit`; the host owes the remainder, which absorbs plus-one shares and rounding. Plus-ones cannot pay because they have no name to resolve.

---

## 3. Module map (what each unit does, depends on, exposes)

```
src/server/ens-v2/
  abi.ts          minimal viem ABIs: registry, resolver, factory, ERC20, ETHRegistrar
  addresses.ts    Sepolia beta addresses + names derived from ENS_PARENT_NAME
  names.ts        label rules, tripName/tableName, dnsName, labelId, default records
  roles.ts        role bitmap constants and composers (registry + resolver)
  chain.ts        ChainAdapter interface + selection (simulated in demo)
  sepolia.ts      SepoliaChain (viem public + operator + concierge wallet clients)
  simulated.ts    SimulatedChain (in-memory registry/resolver with role scoping)
  jobs.ts         ens_jobs enqueue + worker (lease, backoff, attempts, review)
  proof.ts        write proof: receipt + re-read + compare (generalises ens-proof.ts)
  bootstrap.ts    one-off provisioning logic used by scripts/ens-bootstrap.ts

src/server/world/
  adapter.ts      WorldAdapter interface + selection
  live.ts         WorldLive: rp signature, verify endpoint, OIDC client (jose)
  simulated.ts    SimulatedWorld: deterministic proofs, local approve/deny panel
  approvals.ts    agent_approvals state machine + executor registry

src/server/ens-world/
  trips.ts        activate / extend / end / myTrip / tripByName
  gatherings.ts   tables: create / request / approve / decline / leave / cancel / close / list / detail
  split.ts        startSplit / reportPayment / verifyPayment
  concierge/
    brain.ts      ConciergeBrain interface, RuleBrain
    agent.ts      turn(user, message): context prefetch, brain call, proposals to approvals
    tools.ts      read-only tools shared by the agent and the MCP server
    mcp.ts        JSON-RPC handler for src/app/api/mcp/route.ts
  router.ts       handle(...) for every /api route in the spec; isPublicPath()
  dto.ts          public DTO shapes (names only, never wallets or contacts)

src/components/
  views/tables.tsx        /<city>/tables list + host form
  views/table-detail.tsx  /<city>/tables/:id
  views/trip-card.tsx     settings card + activation (IDKit or simulated)
  approval-modal.tsx      approval request, poll, terminal states
  concierge-drawer.tsx    chat drawer with three canned prompts
  human-check.tsx         IDKit widget wrapper (real in production, simulated in demo)
```

Every write goes through `applyWrite`. Every chain write ends with receipt, re-read and compare. Every protected action requires a consumed approval id and is idempotent on it.

---

## 4. Test plan

- Domain (`tests/ens-world-domain.test.ts`): label rules, split maths with guests and rounding, role bitmap composition, simulated resolver role scoping (concierge writing `description` reverts), approval state transitions, nullifier hex to decimal.
- API (`tests/trips.test.ts`, `tests/gatherings.test.ts`, `tests/world.test.ts`): activate happy path and the three failure paths; second account with the same nullifier gets `HUMAN_ALREADY_PRESENT`; request/approve/claim consumes each approval exactly once; denied and expired approvals write nothing; replayed callback rejected; table JSON round-trip through the simulated resolver; split ignores hints until verification; public `trips/:name` leaks no account data; MCP tools are read-only.
- Live (`scripts/ens-smoke.ts`): written and typechecked, run by the owner against Sepolia before the demo; it prints every tx hash for `docs/EVIDENCE.md`.

---

## 5. Merge shape

The drop is a git branch (`ens-world`) on top of `main` at `8c83694`, exported three ways: a patch series (`patches/`), the loose-file layout from spec section 11 (`ens-world-drop/`), and `AGENT-MERGE-GUIDE.md` written for the receiving agent. New files never conflict; the handful of modified files (`router.ts`, `schema.ts`, `seed.ts`, `worker/index.ts`, `platform.tsx`, `app-shell.tsx`, `account.tsx`, `people.tsx`, `now-events.tsx`, `lib/types.ts`, `package.json`, `.env.example`, docs) are listed with the exact hunks.
