# Ship the sign-in and city fixes

- Repository: `alexb0wman/new-friendship-tech`
- Reviewed main: `cdc50461b452052d7d97476ec2d2e64665376d20`
- Date: 26 September 2026
- Branch: `fix/sign-in-and-city-selection`

## What this delivery contains

The latest noun menus and verb homepage cards from `f377af7` and trip copy from `cdc5046` are preserved. The accompanying `fixes.patch` contains implemented code, regression tests, and this handoff. Apply it to a branch based on the reviewed main, review the diff, and deploy a fresh build. There are no new application dependencies or database migrations.

The reported controls had concrete source defects. The deployed browser console, deployed assets, and private production configuration were not inspected, so this report does not claim that every possible cause of the live-site symptom has been established.

| Finding                                                                                                                                    | Fix in this patch                                                                                                                                                                                                                    | Main files                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Sign-in selected Privy using a build-time public ID; a runtime-only deployment could pass preflight while the client had no login handler. | New public, uncached `/api/auth/config` reads the same runtime ID as token verification. It needs no database connection and returns only `demo`, `enabled`, and `appId`. Missing server credentials keep real auth unavailable.     | `session.tsx`, `privy-bridge.tsx`, server `config.ts` and `router.ts` |
| A click during auth initialization could go nowhere, and initialization failures had no recovery.                                          | Queue early clicks until auth is ready; bound config loading to ten seconds; retry through Sign in; show login/logout errors.                                                                                                        | `session.tsx`, `privy-bridge.tsx`                                     |
| City selection existed only in the current pathname; global pages reset to Tokyo. Prefix matching could also select the wrong city.        | Shared published-city context, exact route matching, persisted preference, and storage synchronization. Route changes take precedence over stored preference. Tabs on different city routes do not rewrite one another continuously. | `city-selection.tsx`, `city-navigation.ts`, layout and shell          |
| City picker silently rendered nothing when the API failed or returned no cities.                                                           | Visible loading, error, retry, empty, and selected states; accessible picker name and Escape behavior.                                                                                                                               | `app-shell.tsx`, `shell.css`                                          |
| Other-city screens still displayed Tokyo headings, links, artwork, filters, or event timezones.                                            | City-aware collection, people, events, Now, travel, saved/back links, homepage actions, and global navigation. List sections survive a switch; place/table detail URLs return to the new city's collection.                          | Explore/Now/People/Travel/Superapp views and homepage                 |
| Old API responses could replace a newer city/account result.                                                                               | Abort obsolete resource requests and accept only the latest response; clear data on resource/account changes while retaining same-resource refresh data.                                                                             | `session.tsx`                                                         |
| The latest membership redesign removed the real payment control. Its remaining button and receipts disagreed about $19/$39.                | Restore the existing server-quoted 0G Pay control, payer selection, disclosures, recovery and receipts. Render the actual invoice/quote amount. Add Base to supported wallet chains. Guard settlement refresh against a loop.        | Membership view, `og-pay-trigger.tsx`, `money.ts`, payment adapter    |
| Signed-in preview users clicked locked cards and were sent back through login.                                                             | Locked cards send an existing account to membership; guests still start sign-in.                                                                                                                                                     | `place-card.tsx`                                                      |
| Browser tests targeted old navigation, and CI did not run them.                                                                            | Updated journeys plus desktop/mobile auth/city regression coverage and a browser CI job. Fixed the stale $19 API test and existing formatting failures.                                                                              | `e2e/`, `tests/`, workflow                                            |

Membership remains global and manually renewed. A browser payment callback remains only a verification hint. This patch does not grant access based on a client success event or enable checkout configuration.

## Apply and validate

From a clean checkout of the repository, with the package extracted outside it:

```bash
git fetch origin main
git switch -c fix/sign-in-and-city-selection origin/main
git am --3way /absolute/path/to/fixes.patch
npm ci
npm run format:check
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

If main has advanced, inspect the three-way merge, especially the session provider, root layout, shell and membership view. Do not replace those files wholesale with an older branch. `git am --abort` exits an unresolved patch application without changing the original branch.

Use Node 22 as pinned in `.nvmrc`. The local verification environment used Node 24.19, which is within the package's declared range. The browser job uses the pinned Node version.

## Deployment steps

1. Build a new immutable release. Preserve the previous release for rollback. Do not overlay a running release's JavaScript chunks with a partial build.
2. Set `APP_MODE=production`, the real HTTPS `APP_ORIGIN`, `PRIVY_APP_ID`, and the corresponding server-only `PRIVY_APP_SECRET`. Keep Secret Manager/KMS handling as documented in `GCP-RUNBOOK.md`. A build-time `NEXT_PUBLIC_PRIVY_APP_ID` is no longer required; runtime `PRIVY_APP_ID` is authoritative.
3. In that Privy application's dashboard, enable the intended login methods and allow the exact production origin. Confirm email/embedded-wallet settings. No code patch can substitute for valid provider credentials or an allowed origin.
4. Restart the dedicated app process with the candidate release and updated runtime environment. The supplied PM2 setup runs `next start`; if using standalone output instead, include both `public` and `.next/static` in the deployed standalone directory.
5. Fetch `/api/auth/config` on the candidate origin. Expect `demo: false`, `enabled: true`, and the intended public app ID. This endpoint deliberately exposes no secret. Fetch `/api/health` and `/api/cities` separately to check database health and published city inventory.
6. Run the acceptance checks below against the actual candidate origin. Promote only after the reported controls work. A local simulated login does not verify a real Privy email/wallet flow.

If both controls remain inert, check the browser console and Network panel first. Confirm all `/_next/static/*` files return JavaScript with 200 responses, no stale HTML references removed chunks, and the proxy serves the same release. Confirm `/api/auth/config` and `/api/cities` responses. Do not work around a blocked auth provider by broadly disabling browser security or opening an unrestricted CSP.

## Acceptance checks on the deployed candidate

- In a clean desktop browser, click Sign in immediately after loading. The real Privy flow opens; complete email sign-in; confirm `/api/me` succeeds and the account menu replaces Sign in. Sign out, reload, and repeat with an external wallet.
- Repeat on an actual phone, including return from the wallet or email flow. The local mobile suite uses Chromium with iPhone dimensions; it does not prove Safari/WebView/provider handoff compatibility.
- Select a published second city. Confirm its URL, name, local links and timezone. Navigate to a global page and home, then reload: the selection persists. Switch from `/tokyo/events` to another city and preserve `/events`.
- Open the city picker, close with Escape, reopen, and select a city. Temporarily fail the city endpoint in browser testing: the picker displays an error and Retry cities works after recovery. An empty published-city list displays its explicit empty state.
- Keep one tab on Tokyo and another on Paris; both retain their routes. Returning to a global page uses the latest saved preference without a storage-event loop.
- Confirm any historical $19 invoice remains $19 while a new quote uses the current $39 plan. The real pay control renders only for an actionable real quote. Source/order/destination proof verification still controls settlement.

## Verification record

Initial main had one failing test out of 196: the API expected 1900 cents after the plan changed to 3900. The remediation suite adds runtime auth, city routing, checkout rendering, and browser interaction regressions.

| Check                              | Result                                                                                                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                         | Passed on the rebased source.                                                                                                                                                                                                                               |
| Unit/API/rendering tests           | 213 passed across 17 files. Later upstream commits only changed shell/home copy and layout; no service changes.                                                                                                                                             |
| Desktop/mobile browser coverage    | All 20 scenarios passed across the full run and one targeted cold-start rerun. The full run had 19 passes and a first-page development-compilation timeout; adding a homepage warm-up before interaction timing resolved that case in a fresh-server rerun. |
| Production build                   | Passed on the rebased source with production mode; upstream optional-dependency warnings remain as documented below.                                                                                                                                        |
| Formatting                         | Passed. The compact bulk catalog is explicitly excluded; no venue data was modified.                                                                                                                                                                        |
| Dependency audit at high threshold | Passed; 27 moderate advisories remain.                                                                                                                                                                                                                      |

Browser execution used Chromium 153 from a temporary external test installation because the standard Playwright CDN download returned an invalid empty archive. No browser dependency or machine-specific config is included in this patch. Normal CI installs Playwright's pinned Chromium. The mobile project emulates an iPhone viewport in Chromium, not native Safari.

A successful build or simulated browser journey is not evidence of a real Privy login, World proof or on-chain payment. No deployed credentials, production database, real membership purchase or integration transaction was changed by this delivery.

## Outstanding findings from the latest source

These are separate from the repaired controls and should remain visible in the launch decision.

| Priority                             | Finding and next action                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1 before public traffic             | Anonymous requests share a single 60-request/minute bucket in `src/server/http.ts`. The supplied PM2 config sets `TRUST_PROXY=false`; its alternative reads `CF-Connecting-IP`, which supplied nginx clears. Enough guests can produce a 429 for everyone, including cities. The picker now reports this error, and unnecessary directory requests were reduced, but the limiter needs a tested trusted-ingress identity scheme. Do not simply trust a client-supplied header.             |
| P1 before live money                 | The earlier full audit commit `359c0a7` is not an ancestor of reviewed main. Its security/migration fixes are therefore not present here. Current source still has a unique reservation on unverified source-payment hints and raw unknown-error logging. Review and port the earlier audit fixes, including seat authorization at execution time, ENS renewal/job ordering and migration snapshots, against the latest UI. This focused patch does not silently merge that larger branch. |
| P1 before claiming live integrations | `docs/EVIDENCE.md` contains placeholders. Real Privy, World, ENS and payment acceptance still needs deployment evidence. This patch does not broadcast transactions or configure provider dashboards. Follow `LIVE-LAUNCH-SPEC.md`; preserve the code's distinction between existing ENS names and the trip namespace's Sepolia implementation.                                                                                                                                            |
| P1 before live money                 | Payment replacement/refund/review recovery remains incomplete. A wrong first source hash or a replaced transaction can strand an invoice in review. Restore or restart obligations only after independently verifying the evidence; never add a manual mark-paid path.                                                                                                                                                                                                                     |
| P2                                   | The 50 fictional demo profiles from the earlier audit are also absent from this main. Current seed still has six fictional accounts and five switcher entries. Port the demo population separately, preserve fixture labels, and keep it out of production imports.                                                                                                                                                                                                                        |
| P2                                   | Published cities can have no content. The demo publishes Paris/New York/Los Angeles but supplies no venue inventory for them. Correct navigation cannot create reviewed content; publish only useful collections in production.                                                                                                                                                                                                                                                            |
| P2                                   | The build reports upstream optional Farcaster/Solana and viem/ox dynamic-import warnings. The supported email/EVM paths still need real-provider browser acceptance. Do not add arbitrary dependencies merely to hide warnings.                                                                                                                                                                                                                                                            |

`docs/reference/` and older design/handoff documents include historical plans and prices. Current behavior is defined by current source, integration contracts, and this delivery. Broadly formatting a legacy document does not make its historical claims current.

The dependency audit at this revision exits successfully at the high-severity threshold, with **27 moderate advisories** in transitive wallet packages and development tooling. It is not a zero-advisory result. Review compatible upstream updates separately; `npm audit fix --force` currently proposes breaking downgrades and was not applied.

## Rollback

Repoint the dedicated app to the previous immutable release and restore its matching asset set and runtime configuration. This patch has no schema migration to reverse. Keep reconciliation workers and existing invoice records intact. If checkout behavior is uncertain, stop new initiation through the checkout flag while preserving reconciliation of existing submissions.
