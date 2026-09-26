# Merge guide for the receiving agent

You are merging the ENSv2 + World ID drop into `alexb0wman/new-friendship-tech`. This file tells you what the drop is, three ways to apply it, every file it touches and why, how to verify the result, and what only the project owner can do afterwards. Read it fully before touching the repository. Nothing in the drop replaces a repo invariant; where it touches one, this guide says so.

## 1. What you are merging

- Base: `main` at commit `8c83694` ("feat: four-topic navigation with submenus and a content system").
- Branch: `ens-world`, 17 commits on top of that base, authored 2026-09-26.
- Size: 74 files, about 13,000 lines added, 140 removed: 53 new files (source, tests, migration, scripts, docs) and 21 modified files. `MANIFEST.txt` is the exact list.
- Verified on the branch, Node 24.13 and the pinned lockfile: `npm run typecheck` clean, `npm test` 91 passed (44 pre-existing, 47 new), `npm run build` passes, `npm run smoke` passes, browser click-through of the demo script done in `npm run demo`.
- Spec and design: `docs/ENS-WORLD-SPEC.md` (owner spec) and `docs/ENS-WORLD-DESIGN.md` (decisions and every deviation). The design doc wins where they disagree.

What it adds, in one paragraph: a member's trip is an expiring, non-transferable ENSv2 subname (`maya.tokyo.<parent>.eth`, expiry = departure) minted only after a World ID proof of human; small meals are data-only subnames under `tables.<city>` whose attendee record is written by a concierge wallet that holds setter roles for exactly two text keys; seats, Right now posts and contact reveals are approved through World ID for Agents step-ups; the bill is split from names and verified on chain; the concierge is a named agent with ENSIP-26 records and a read-only MCP endpoint. Demo mode and tests run on simulated chain and World adapters; production uses Sepolia and the World sandbox.

## 2. Four ways to apply it, in order of preference

### 0. Fetch the branch from the fork (when you have the link)

```bash
git remote add drop https://github.com/don-radman/new-friendship-tech.git
git fetch drop ens-world
git checkout main
git merge --no-ff drop/ens-world
```

The fork is a plain fork of this repository; `ens-world` is the only branch that matters. The routes below deliver the same commits inside the zip.

### A. Fetch the bundle and merge (keeps history, easiest conflicts)

```bash
git fetch /path/to/ens-world-drop/ens-world.bundle ens-world:ens-world
git checkout main
git merge --no-ff ens-world
```

If `main` has moved since `8c83694`, prefer `git rebase main ens-world` first and resolve conflicts commit by commit; the commits are small and topical.

### B. Apply the patch series

```bash
git am --3way /path/to/ens-world-drop/patches/*.patch
```

Patch `0001` is the optional `Bell` import fix (see section 6). Skip it with `git am --skip` if `main` already imports `Bell` in `src/components/app-shell.tsx`.

### C. Loose files plus per-file diffs (no git history)

New files live at their repository path under the drop root: copy them over. Modified files are shipped as `<path>.patch` next to where they belong (a unified diff against `8c83694`): apply each with `git apply --3way <path>.patch`, or read the hunk summary in section 4 and make the edit by hand. Then run `npm install` (the lockfile diff adds `@worldcoin/idkit` 4.3.0 and its four transitive packages).

Whichever route you take, finish with section 5.

## 3. New files by area

| Area             | Files                                                                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration        | `drizzle/0003_trips_tables_world.sql` (hand-written, see section 6)                                                                                                                                                           |
| ENSv2            | `src/server/ens-v2/{abi,addresses,bootstrap,chain,encode,jobs,names,proof,roles,sepolia,simulated,types}.ts`                                                                                                                  |
| World ID         | `src/server/world/{adapter,approvals,live,simulated}.ts`                                                                                                                                                                      |
| Product services | `src/server/ens-world/{trips,gatherings,split,dto,router,handlers,seed}.ts`, `src/server/ens-world/concierge/{agent,brain,custom-brain,mcp,tools}.ts` and its `README.md`                                                     |
| Next route       | `src/app/api/mcp/route.ts` (the MCP endpoint needs its own route because the catch-all API enforces an exact `Origin` header on POST)                                                                                         |
| UI               | `src/components/{approval-modal,concierge-drawer,human-check,idkit-widget}.tsx`, `src/components/views/{tables,table-detail,trip-card}.tsx`, `src/app/ens-world.css`                                                          |
| Scripts          | `scripts/ens-bootstrap.ts`, `scripts/ens-smoke.ts` (unexecuted against Sepolia)                                                                                                                                               |
| Tests            | `tests/helpers.ts`, `tests/{ens-world-domain,trips,gatherings,world,concierge}.test.ts`                                                                                                                                       |
| Docs             | `docs/ENS-WORLD-SPEC.md`, `docs/ENS-WORLD-DESIGN.md`, `docs/WORLD-DEBRIEF-IDKIT.md`, `docs/WORLD-DEBRIEF-AGENTS.md`, `docs/EVIDENCE.md`, `docs/superpowers/plans/2026-09-26-ens-world-drop.md` (the build plan, keep or drop) |

## 4. Modified files and what changed in each

Every hunk is additive or a contained refactor. If `main` moved, these are the places conflicts can appear.

| File                                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/router.ts`                             | Import `./ens-world/router`; demo actor enum now derived from `DEMO_ACTORS`; `/config` spreads `ensWorld.publicConfig()`; the `optional` auth predicate also accepts `ensWorld.isPublicPath(path, method)`; one delegate block calls `ensWorld.handle(...)` right after `rateLimit` and before the `UNAUTHENTICATED` invariant. Nothing else moved.                                                                                                                                    |
| `src/server/db/schema.ts`                          | `numeric` import; three nullable columns on `users` (`verified_human_at`, `world_agent_issuer`, `world_agent_sub`); six new tables appended at the end with their row types.                                                                                                                                                                                                                                                                                                           |
| `src/server/db/seed.ts`                            | `DEMO_ACTORS` gains `kenji` and `ari` (both already existed as fixture users).                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/server/db/index.ts`                           | Demo branch also runs `seedEnsWorldDemo(db)` after `seedDemoContent(db)`.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `src/server/social.ts`                             | `publicMember(row, ensName, extras?)` adds `tripName`, `verifiedHuman`, `now` (defaults null/false/null); `listMembers` and `memberDetail` look up `tripBadges`; `me()` adds `verifiedHuman` and `worldAgentLinked`; `respondRequest` and `createNow` are split into `respondRequestIn(tx, ...)` / `createNowIn(tx, ...)` so approval executors can run them inside the approval transaction. Behaviour of the existing endpoints is unchanged (the 44 pre-existing tests still pass). |
| `src/server/secrets.ts`                            | Secret Manager allowlist gains the two wallet keys, the RP signing key and the OIDC client secret.                                                                                                                                                                                                                                                                                                                                                                                     |
| `src/worker/index.ts`                              | Imports the handlers barrel and runs `runEnsWorkerOnce` after the payments worker each loop.                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/lib/types.ts`                                 | `PublicMember` gains three fields, `Me.user` gains two, and the new DTO types are appended.                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/components/session.tsx`                       | `RuntimeConfig` gains `world`, `ensParent`, `splitOgPayEnabled`, `origin`.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/components/app-shell.tsx`                     | Imports `Bell` (pre-existing bug) and `ConciergeDrawer`; Travel submenu gains "Tables"; the drawer mounts after `<main>` when signed in.                                                                                                                                                                                                                                                                                                                                               |
| `src/components/platform.tsx`                      | Routes `/<city>/tables`, `/<city>/tables/:id`, `/approvals/:id`.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/components/views/account.tsx`                 | Mounts `<TripCard />` as the first settings panel.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `src/components/views/people.tsx`                  | Member cards show the trip name, the verified-human badge and the current Right now.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/components/views/now-events.tsx`              | With an active trip and a linked World ID, "Make a plan" posts through the concierge (approval, then written on the name); otherwise the original direct post.                                                                                                                                                                                                                                                                                                                         |
| `src/app/globals.css`                              | One line: `@import "./ens-world.css";` after the Tailwind import.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `package.json`, `package-lock.json`                | `@worldcoin/idkit` 4.3.0 pinned; scripts `ens:bootstrap` and `ens:smoke`.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `.env.example`                                     | The ENS, World and concierge block appended (section 7).                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `README.md`, `docs/API.md`, `docs/INTEGRATIONS.md` | New routes, actors, repository map, the ENSv2 and World sections.                                                                                                                                                                                                                                                                                                                                                                                                                      |

## 5. Verify after merging

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run smoke
npm run demo
```

Expected: typecheck clean; `Tests 91 passed` (7 files); build lists `ƒ /api/mcp`; smoke passes. In the demo (`http://127.0.0.1:3000`): pick "Maya · All Access", open Settings, activate the trip with the simulated World ID panel, link the concierge; open Travel > Tables, ask to join Kenji's dinner and approve; switch to "Kenji · All Access", open the table, approve Maya with his own step-up; switch to "Ari · All Access", activate first with Maya's identity string (rejected) then her own, ask to join and decline the step-up; as Kenji split the bill, as Maya pay with simulated USDC. `docs/ENS-WORLD-SPEC.md` section 10 is the full script.

`npm run format:check` fails on `main` already (seven files unrelated to this drop: `content/asia-catalog.json`, `scripts/spike-integrations.mjs`, `src/server/{admin,catalog-import,catalog,editorial}.ts`, `src/server/payments/adapter.ts`). Every file this drop adds or edits passes Prettier.

## 6. Things you must know about the repository as it is

1. `src/components/app-shell.tsx` on `main` renders `<Bell />` without importing it, so `npm run typecheck` fails before this drop. Patch `0001` adds the import. Drop it if `main` fixed it.
2. `drizzle/0002_content_items.sql` on `main` is hand-written and absent from `drizzle/meta/_journal.json` and `drizzle/meta/`. The demo and tests apply every `.sql` file in order (`src/server/db/index.ts`), but `scripts/migrate.ts` uses Drizzle's migrator, which reads the journal, so production would skip `0002` and now `0003`. This drop follows the `0002` precedent (hand-written `0003`, no meta regeneration) so as not to widen the problem. Before a production migration, add journal entries for `0002` and `0003` (or regenerate meta once from the full schema) and test on a scratch database.
3. `@0gfoundation/0g-pay-sdk` cannot be bundled on `main`: it depends on `@tokenflight/adapter-ethers`, which requires `ethers`, which is not installed. `OgPayTrigger` is never mounted on `main`, so the build never noticed. This drop does not mount it either; `SPLIT_OGPAY_ENABLED=true` renders a note. Design doc section 2.9 says what to add if the owner wants 0G Pay in the demo.
4. All demo account ids share their first eight characters. Anything that derives a per-account identity must use the id suffix (the drop does).
5. PGlite is a single connection: never call a service that opens its own transaction from inside another transaction. That is why `social.ts` gained `respondRequestIn` and `createNowIn`.
6. `scripts/http-smoke.mjs` prints its verdict and then never exits on Windows: it stops its detached `next dev` child with `process.kill(-pid)`, a Unix-only idiom, so the child keeps port 3092 and the parent waits on its pipes. Read the verdict, then kill the listener on 3092. On Linux and macOS it exits normally.

## 7. Environment

Demo mode needs none of this. For a live deployment add, to `.env` or Secret Manager (`SECRET_ENV_MAP`, allowlist already extended):

```
ENS_ENABLED=true
ENS_WRITE_ENABLED=true
ENS_SEPOLIA_RPC_URL=
ENS_PARENT_NAME=<label>.eth
ENS_PARENT_REGISTRY=
ENS_CITY_REGISTRY_TOKYO=
ENS_APP_RESOLVER=
ENS_OPERATOR_PRIVATE_KEY=
ENS_CONCIERGE_PRIVATE_KEY=
WORLD_APP_ID=
WORLD_RP_ID=
WORLD_RP_SIGNING_KEY=
WORLD_ACTION_TRIP=trip-activate
WORLD_ENVIRONMENT=staging
WORLD_AGENTS_ISSUER=https://sandbox.auth.world.org
WORLD_AGENTS_CLIENT_ID=
WORLD_AGENTS_CLIENT_SECRET=
WORLD_AGENTS_REDIRECT_URI=https://<app-origin>/api/world/agent/callback
CONCIERGE_BRAIN=rules
SPLIT_OGPAY_ENABLED=false
```

`npm run ens:bootstrap` prints the four `ENS_*` address values. The redirect URI must be public HTTPS; the sandbox refuses localhost.

## 8. Simulated versus live

| Concern             | Demo and tests                                                                             | Production                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Chain               | `SimulatedChain` (in-memory registry and resolver, role scoping enforced, expiry honoured) | `SepoliaChain` (viem, operator and concierge wallets, Universal Resolver reads) |
| World ID proof      | `{ simulated: true, human }` payload, nullifier = hash of `human`                          | IDKit v4 widget, Developer Portal verify, signal hash check                     |
| World ID for Agents | `simulated://approval/<id>` URL, approve/deny panel posting to a demo-only route           | OIDC code + PKCE against the sandbox, RS256 ID token validation                 |
| Chain jobs          | Drained inline after each write                                                            | `npm run worker` (same process as the payments worker)                          |
| Split payment       | Simulated USDC transfer                                                                    | MockUSDC `transfer` from the member's wallet, verified by the worker            |

Nothing has been executed against Sepolia or the World sandbox yet. `docs/EVIDENCE.md` lists every hash the live run must produce.

## 9. Only the owner can do these

1. Register `<parent>.eth` on the Sepolia ENSv2 registrar (the ENS app for Sepolia, or `npm run ens:bootstrap -- --register-parent` with MockUSDC).
2. Fund two Sepolia wallets and run `npm run ens:bootstrap`; commit `ens-bootstrap.output.json`; set the printed env.
3. Create the World app in the Developer Portal (`app_id`, `rp_id`, signing key) and the action `trip-activate`.
4. Register the sandbox OIDC client at `https://sandbox.auth.world.org/portal` with the public callback URL (Google sign-in, human approval within 20 minutes).
5. Deploy behind HTTPS, run `npm run ens:smoke`, fill `docs/EVIDENCE.md` and the two debriefs' timing lines.
6. Decide on 0G Pay for the split (section 6, item 3) and on a model-backed concierge brain (`src/server/ens-world/concierge/README.md`).

## 10. Where to look when something is off

- Route not found: `src/server/ens-world/router.ts` handles every new path; `isPublicPath` decides which run without a session.
- A write "succeeded" but the record is wrong: every chain write ends in `assertChainWriteProof` (`src/server/ens-v2/proof.ts`); a mismatch lands the job in `ens_jobs.status = review` with `last_error`.
- An approval did nothing: `agent_approvals.status` and the audit log (`approval.*` actions) say why; `denied`, `expired`, `APPROVAL_SUBJECT`, `APPROVAL_STALE` and `APPROVAL_CONSUMED` are deliberate outcomes.
- The concierge wrote a key it should not: it cannot; `simulateSetText("concierge", name, "description", ...)` reverts in both adapters and the smoke script proves it on Sepolia.
