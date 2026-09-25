# Start here for the receiving build agents

## First hour

Run `npm ci && npm run demo`. Review `/`, `/tokyo`, `/tokyo/people`, `/tokyo/now`, `/requests`, `/membership`, `/settings` and `/admin`. Exercise both sides of a connection by switching Maya and Alex. Complete a simulated purchase as Alex and inspect the invoice/entitlement code. Read `INTEGRATIONS.md` before wiring wallets or payment callbacks.

There is already a working service layer and data model. Extend those services rather than putting entitlements in browser state, writing a second auth system or creating separate memberships for each city.

## Suggested work packages

| Owner           | Inputs                                                                                    | Concrete output                                                                                              | Stop condition                                                                         |
| --------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 0G integration  | Official merchant route, recipient, chain/asset, funded operator wallet                   | Real quote + proof adapter, typed callback wiring, genuine settlement tests                                  | Source/order/destination binding cannot be independently proved: leave checkout closed |
| ENS integration | Sepolia RPC, controlled ENSv2 namespace or name, wallet roles                             | Verified name linking, namespace issuance if feasible, transaction-bound text-record write, sponsor evidence | No confirmed v2 deployment or permissions: do not fake an identity                     |
| GCP operator    | Existing private VM/database conventions, domain and service identity                     | Dedicated candidate release, migration, Secret Manager/KMS, PM2, logs and backup proof                       | Do not modify unrelated shared infrastructure                                          |
| Content/brand   | Reviewed Tokyo exports, original descriptions, source URLs, licensed font and city images | 20–30 useful places, 3–5 verified events if available, branded assets                                        | Do not publish sample recommendations as real venues                                   |
| Framer          | Original brief, homepage in `src/app/page.tsx`, CSS tokens                                | Responsive apex marketing site linking to the app                                                            | No app secrets or member database in Framer                                            |
| QA/submission   | Candidate deployment, credentials, actual event rules                                     | Mobile/desktop checks, real integration evidence, demo recording, honest public repository                   | Do not call untested source production-ready                                           |

Only parallelize these work packages if the project owner explicitly assigns them. The current handoff was produced in one coding session without separately spawned agents.

## Contracts to preserve

- One global $19 / 30-day plan. Every published city included. Renewal is manual.
- The launch city is Tokyo. Other cities need reviewed content and appropriate UI copy.
- 60K+ is cumulative event attendance across the brand's events. Approximately 60K newsletter subscribers is a separate claim. Neither is an app-user count.
- No Stripe in the alpha. No in-app chat, AI concierge, complex itinerary builder, graph visualization, loyalty token or NFT mint required for this release.
- Keep mainnet money separate from Sepolia identity experimentation.
- Leave received/accepted connections and the saved library available when paid access expires.
- Contacts are private until consent and acceptance. Do not put them in ENS text records or public profile JSON.
- The repo is open source; private operational documents, email lists, venue exports with restricted rights and licensed font binaries are not.

## Public repository and submission

Create the intended GitHub repository under the user's account/organization only when that destination is supplied and publication is authorized. This deliverable already includes real local commits and an optional git bundle. Preserve history. Document brand material and ideation that predate the hackathon separately from code created during it. The event may apply its own AI/solo/team rules; confirm them rather than inferring eligibility.

`AI-USAGE.md` discloses generated code. Add your actual commits, test records, deployed URL and integration transaction links. Record only transactions that really happened.

## Framer extraction

Use the homepage section order, copy and responsive rules as a concrete reference. The reusable design values are `--bg`, `--surface`, `--raised`, `--text`, `--muted`, `--lime`, `--border` and `--font` in `src/app/globals.css`. Marketing classes start with `marketing-`, `landing-`, or are visible around the homepage sections. Product app components are not automatically importable as native Framer components; rebuild the marketing composition or use an explicitly supported code-component workflow. Keep login, membership and all private state in the app subdomain.
