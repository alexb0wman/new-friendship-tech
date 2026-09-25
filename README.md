# New Friendship Tech

A runnable Tokyo alpha for a global connection membership. Built with Next.js, React, TypeScript, Drizzle and PostgreSQL. Marketing and app screens share a dark editorial design system with lime accents and Aeonik Pro font hooks.

**Local demo works without accounts, secrets, PostgreSQL installation, or a wallet. Live payments are intentionally closed until the 0G merchant settlement adapter is implemented and verified.**

## Run it now

Requires Node.js 22 or 24 and npm. Node 22 is the deployment target.

```sh
npm ci
npm run demo
```

Open **http://127.0.0.1:3000**. Use the account selector at the top of app screens:

| Account | Try this                                                      |
| ------- | ------------------------------------------------------------- |
| Alex    | Free preview → membership → simulated purchase → full catalog |
| Maya    | Paid discovery, saved places, introductions, Right now        |
| Host    | Content editor, member moderation, reports, invoices          |

Use Maya to send Alex a request, switch to Alex, accept it, and see the sample contact appear. Switch back to Maya to see the reciprocal result. All people, venues and events in this demo are fictional and visibly labeled. The database resets when the process restarts. No funds move, no email is sent, and no real ENS identity is fabricated.

Do not set `NODE_ENV=production` for the demo. The server refuses this combination. Do not publish the local demo as a real paid product.

## What is implemented

- Marketing homepage and responsive app, including desktop navigation, mobile bottom navigation, filters, dialogs, loading/error/empty states, reduced motion and keyboard focus styles.
- Tokyo preview/full catalog with server-side membership gating, categories, search, neighborhood filters and explainable preference ranking.
- City-independent All Access: **$19 for 30 days**, manual renewal, all published cities included. Ten new connection requests per current access period. No city passes or feature tiers.
- Profiles and onboarding; opt-in discoverability; member directory; immutable internal account IDs with separately linked wallets and names.
- Private connection requests, reciprocal-request prevention, acceptance/decline/cancel, per-period quota, blocking, reporting and suspension.
- Mutual-contact reveal after acceptance and sharing consent. Production contact encryption uses envelope encryption with Google Cloud KMS. Demo encryption is explicitly local only.
- Right now invitations with a maximum six-hour lifetime and server-side expiry; one active invitation per member.
- Saved places/events retained after membership expiry; accepted connections also persist.
- Events linking out to registration, with no invented ticket inclusion or attendance count.
- Privy provider UI and server token verification; verified-wallet synchronization from Privy.
- ENS normalization, fresh Sepolia resolution, wallet association, lookup, simulated resolver permission check, wallet-signed description updates and post-transaction re-read. Real RPC/wallet exercise remains unverified.
- SQL invoices, immutable quote obligations, settlement validation, replay constraints, renewal serialization, idempotency and a durable leased retry worker. The demo runs through those same application services using a simulation adapter.
- Admin place creation/update API, member suspension, report resolution and reconciliation retry. No manual “mark paid” bypass.
- Dedicated production PostgreSQL migration runner, reviewed-content JSON import, administrator bootstrap, runtime Secret Manager loader, PM2 config, local PostgreSQL compose file and launch preflight.

## What is not finished

Read [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) before enabling external services.

1. **0G Pay mainnet merchant checkout:** SDK UI integration point exists, but the adapter deliberately throws until server quote binding and independently verifiable destination settlement are established. Setting `CHECKOUT_ENABLED=true` does not enable it. There is no hidden Stripe fallback.
2. **ENSv2 namespace issuance:** existing-name linking and resolver record editing are coded. Parent-name registration, role setup, subname issuance and sponsor eligibility evidence are not implemented or tested here.
3. **Privy, KMS and GCP:** code is present; credentials, allowlisted domains, permissions and live integration testing are still required. Nothing has been deployed.
4. **Content and branding:** supply the original Tokyo recommendations, city images and licensed Aeonik Pro files. The source contains no imported Google Maps dataset or proprietary fonts.
5. **Launch operations:** complete the real seller/support/refund/privacy information, mainnet receipt and refund exercise, browser/mobile tests, production database concurrency checks, external logs, backup and restore check.

This is an implementation handoff, not a claim that the paid production service or prize submission is complete.

## Routes

| Route                              | Purpose                                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| `/`                                | Portable marketing reference for the Framer implementation |
| `/tokyo`                           | Personalized places and preview                            |
| `/tokyo/places/:slug`              | Recommendation detail                                      |
| `/tokyo/people` and `/members/:id` | Member discovery                                           |
| `/tokyo/now`                       | Temporary invitations                                      |
| `/tokyo/events`                    | Events and external registration                           |
| `/saved`                           | Private saved library                                      |
| `/requests`                        | Incoming, outgoing and accepted connections                |
| `/onboarding`, `/settings`         | Profile, privacy, wallets and ENS                          |
| `/membership`, `/checkout/:id`     | Access and invoice status                                  |
| `/admin`                           | Restricted operations                                      |
| `/privacy`, `/terms`               | Explicitly incomplete launch policy placeholders           |

## Work on the code

```sh
npm run typecheck
npm test
npm run build
npm run smoke
npm run format:check
```

Vitest runs actual request handlers and SQL migrations against PGlite, plus domain checks. The HTTP smoke starts a local Next server and exercises real HTTP routes. `npm run build` checks production compilation; it does not prove production credentials or live payments.

Browser tests are provided for the receiving environment:

```sh
npx playwright install chromium
npm run test:e2e
```

They have **not been executed in the authoring environment**. They use a local demo server on port 3091. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the actual verification record and remaining gates.

## Repository map

```text
src/app/                    Next routes, homepage, styles and runtime initialization
src/components/             App screens, session, Privy and 0G Pay UI boundaries
src/server/db/              Schema, transaction audit and demo fixtures
src/server/payments/        Invoices, proof validation, adapters and retry service
src/server/{auth,ens,...}   Auth, identity, social, catalog, privacy and API routing
src/worker/                 Durable settlement worker entrypoint
scripts/                    Migration, import, preflight, admin and HTTP smoke
content/                    Reviewed-content import template
deploy/                     PM2 and ingress examples
drizzle/                  SQL migrations and schema snapshots
tests/                      Executed API/domain test suite
e2e/                        Browser tests supplied for the next environment
docs/                       Architecture, operations, integrations and handoff
public/art/                 Original temporary SVG illustrations
public/fonts/               Licensed-font placement instructions; no binaries
```

Do not edit an applied SQL migration; generate a new migration for schema changes.

## Public source

Code and original placeholder SVGs are MIT licensed. Aeonik Pro, owner-supplied imagery, private content exports, member data and secrets are excluded. Brand names do not grant trademark rights. Keep the source public for judging while production data stays private. Use actual commit history; do not rewrite timestamps to imply work happened earlier. See [AI-USAGE.md](AI-USAGE.md) and [docs/HANDOFF.md](docs/HANDOFF.md).
