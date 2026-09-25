# New Friendship Tech — agent build handoff

Read New-Friendship-Tech-SPEC.md first. The latest commercial decision is **one All Access membership, $19 for 30 days, covering every published city and all released member features**. Tokyo is the first fully usable city. Do not implement the earlier Explore/Connect/Circle tier proposal.

This is a build brief for the user's agents. It does not mean the app or infrastructure has already been created.

## Start here: orchestration prompt

> Build the New Friendship Tech Tokyo alpha from the attached specification within the remaining 36-hour window. Preserve the user's latest decisions: one global All Access membership, Tokyo-first content, real mainnet payments through 0G Pay, no Stripe, Privy authentication, meaningful ENSv2 on Sepolia, Aeonik Pro, Framer marketing and GCP app.
>
> Start with a thin technical spike for authentication, a real ENSv2 read/write, and 0G Pay developer-mode payment verification. Payment correctness is the highest-risk dependency. Do not begin optional features until the spike identifies a verifiable supported merchant flow.
>
> Use Next.js 16+, Node 22 LTS, TypeScript, Tailwind, Drizzle, PostgreSQL 16, and the supplied GCE/PM2 operating path. Use private infra-ops for deployment targets; do not publish the internal host map. One app and one durable payment worker are enough.
>
> Create API/data contracts first, with a single owner for schema, dependencies, migrations, shared types, and global CSS. Parallel agents may implement separate modules after contracts are agreed. Use isolated branches/worktrees if available. Only the integration owner runs the release build and migrations.
>
> Commit meaningful progress, preserve prompts/specs, and document AI assistance. Keep production secrets, private contacts, customer data, licensed fonts, and infrastructure inventories out of the public repository.
>
> Return evidence at each checkpoint: implemented behavior, exact commit, tests executed, unresolved failures, and the next blocking dependency. Never report a mock, a callback, a health check, or an admin entitlement grant as a real verified payment.
>
> Proceed with reversible implementation while inputs are pending. Request only the specific missing configuration needed for a concrete release step. Respect the supplied operating model's production cutover and spending controls; do not re-ask product questions already resolved in the spec.

## Ownership and sequencing

| Work package | Owns | Depends on | Must not change without coordination |
|---|---|---|---|
| A. Foundation/integration | Auth, schema, shared contracts, dependencies, migrations, app shell, deployment | Configuration | All shared infrastructure files |
| B. Payments | Invoice adapter, worker, verification, entitlement grant, checkout UI | Auth subject + DB contracts | Auth provider, schema without owner agreement |
| C. ENSv2 | Clients, name linking/claiming, records, member lookup adapter | Wallet links + profile visibility | Payment network/treasury settings |
| D. Product | Onboarding, places, saves, people, requests, Now, events | Shared API contracts | Membership semantics or auth |
| E. Framer | Marketing site, copy, responsive presentation | Asset pack + APP_ORIGIN | App authentication or payment logic |
| F. Verification/docs | Critical tests, mobile QA, evidence, demo script | Working slices | Product scope |

For a solo operator, these are work packages, not a requirement to supervise six simultaneous agents. Start A plus B/C spikes. Begin D when contracts stabilize; E is independent once copy and design tokens are fixed. Avoid six agents editing package.json or the schema.

## A. Foundation and integration prompt

> Implement the production foundation of the New Friendship Tech alpha. The account ID is a UUID linked uniquely to the verified Privy subject. Wallets and ENS names are linked identifiers, not the account's primary identity.
>
> Implement server auth, session restoration, account ownership checks, an opt-in profile projection, and global membership checks. The only paid product is all_access_30d at 1900 USD cents. Entitlements have no city scope. Adding a published city must automatically make it accessible to existing paid members.
>
> Create Drizzle schema, reviewed additive migrations, applyWrite with redacted auditing, and Zod contracts. Retain private data only where a feature needs it. Contacts use the KMS envelope-encryption path. Provide developer fixtures that cannot accidentally enter production.
>
> Build the shared token file, accessible app shell, navigation, loading/empty/error components, and settings. All authored typography uses Aeonik Pro when supplied; document development fallback and proprietary asset injection.
>
> Expose feature flags: checkout_enabled, ens_claim_enabled, ens_write_enabled, now_enabled, member_directory_enabled, and enrollment_open. A checkout kill switch stops new purchases but keeps reconciliation running.
>
> Follow the established private GCP deployment path. Create an isolated product database/role/process/runtime identity. Do not modify another product's runtime, migrate to Cloud Run, enable unapproved recurring spend, or commit internal infrastructure details.
>
> Deliver a fresh-account sign-in → onboarding → place browse → save → refresh vertical slice, a source build, and evidence of an actual database write.

Foundation API conventions:
- Derived authenticated actor; never trust user_id from client input.
- Bounded pagination and consistent error envelope.
- No raw contacts in member/profile serializers.
- Server access checks for every paid endpoint.
- Idempotency keys on invoice creation and request actions.
- Shared timezone handling; UTC storage, Asia/Tokyo rendering.
- Versioned plan configuration and quoted purchase terms.

## B. Payments prompt

> Read section 10 before writing checkout. Inspect the actual pinned 0G Pay SDK and its upstream types. Stable 0.2.1 was inspected in research; do not assume that a future version exposes identical props.
>
> Use an EIP-1193 provider, developer mode, an explicit merchant recipient, and crypto-only methods. Prove what outputAmount means and whether exact-input or exact-output is supported through the exported component. The published REST deposit fields do not show a custom recipient. Do not invent one or silently substitute that deposit flow for developer-mode collection.
>
> Produce an adapter contract with createQuote, recordSubmission, readStatus, verifySettlement, and reconcile operations. These are our application interfaces, not claims that 0G Pay has identically named APIs.
>
> The server must bind the invoice to the authenticated account and verified source wallet; validate price, chain, asset, recipient, and final settlement; and correlate the provider/source/destination evidence. For cross-chain settlement, a solver may be the destination sender, so payer attribution requires source-to-order linkage.
>
> Implement durable SQL jobs, leases, backoff, upstream rate-limit compliance, restart recovery, and atomic idempotent entitlement activation. Browser callbacks are hints only. Timeout means pending until reconciled, not automatic retry or failure.
>
> Restrict supported routes to those actually demonstrated. If a route cannot be verified, leave it unavailable and report the exact missing evidence. Do not replace 0G Pay with Stripe or a generic raw-transfer button without a new product decision.
>
> Before release, show an operator-authorized real mainnet purchase reaching the treasury, one entitlement, replay rejection, wrong-recipient rejection, and recovery after a browser close/worker restart. Keep checkout disabled until this evidence exists.

Required adapter output:
- Actual package versions and supported wallet/source route.
- Destination chain/asset and merchant configuration.
- Quote binding and freshness mechanism.
- Provider identifiers available to the server.
- Settlement fields and independent verification method.
- Finality rule with a source or provider-specific rationale.
- Known fees/slippage and handling of under/over/late payments.
- Test evidence and a small runbook for pending/refunded orders.

Do not assume an exact source-chain allowlist in advance. A clean single route is preferable to advertising unverified combinations.

## C. ENSv2 prompt

> Implement the ENSv2 passport as a functional discovery and connection primitive. Use Ethereum Sepolia and current official ENSv2 contracts, not mainnet ENSv1 relabeled as v2.
>
> Pin supported libraries and ABIs. Verify deployments from the official docs and on-chain code. Implement normalization, resolution, forward verification, wallet ownership checks, and fresh resolver reads before writes.
>
> Establish an authorized project subname namespace using supported contracts/factories. Configure a permissioned resolver so the actual member can update allowed public records. Demonstrate a real subname, a member write, a fresh independent read, and an unauthorized-write rejection.
>
> Link ENS to a stable app user through a verified wallet. Name search must find an opted-in member and lead to the existing request service. A transferred name must not transfer an account, old requests, contacts, or membership.
>
> Keep public record scope minimal and opt-in. No contacts, travel dates, payment status, or precise location on chain. Label Sepolia clearly and keep the payment treasury isolated.
>
> If automated issuance takes too long, use genuinely provisioned names with a working link/edit/lookup flow. Record the limitation. Do not claim prize eligibility if the v2 integration is only a mock, badge, or hardcoded mapping.

Deliver ENS_INTEGRATION.md with contract addresses, chain IDs, versions, transaction links, name/registry/resolver permissions, privacy decisions, and how the v2 feature matters to the user journey.

## D. Product prompt

> Implement the app routes and states from the master spec. The design is dark editorial, lime-accented, and Aeonik Pro throughout. Preserve the reference's generous typography and framed imagery without cloning its content.
>
> Build deterministic tailored Tokyo discovery from real curated records, private saves, opt-in profiles, a single connection-request service, and short-lived Right now invitations. Requests require mutual acceptance before contact reveal. The same service handles requests from a member profile, ENS search, or a Now invitation.
>
> Use one global All Access membership. A member's saved library and accepted connections survive expiry and city changes. Catalog records are city-specific; membership is not. Do not ship a multi-tier upgrade page.
>
> Render only published cities. Prepare city metadata and a simple editorial publication workflow, but do not make empty city dashboards. A future city is included automatically as soon as real content is published.
>
> Keep event registration external and official. A saved event is a bookmark, not an RSVP. Do not fabricate operational data, member counts, endorsements, ratings, opening hours, or event availability.
>
> Implement mobile bottom navigation, filter sheets, proper dialog focus, loading/error/empty states, and long-text handling. No full messaging, relationship graph, leaderboard, native app, or map import in P0.

Content acceptance:
- 24 actual reviewed Tokyo places minimum; target 36.
- Six genuinely useful preview places.
- Sources and last-review dates stored.
- No Google review/photo scraping.
- Curator notes written originally.
- At least two real consenting accounts for social QA.
- Production uses real people only; demo fixtures are isolated.

## E. Framer prompt

Use FRAMER-PROMPT.md verbatim as the initial brief. Supply the shared asset pack and APP_ORIGIN. After generation, manually check mobile composition, typefaces, contrast, menus, links, and whether marketing claims match the features actually enabled.

Framer must not become a second authentication system or checkout implementation.

## F. Verification and submission prompt

> Verify the intended behavior against the master spec and report failures with reproduction steps. Prioritize payment attribution/idempotency, privacy, ownership, ENS correctness, and phone usability.
>
> Confirm membership works across published cities using a second city fixture only in a controlled test environment. Do not make that fixture public or imply it is a live city catalog.
>
> Verify absence of private contacts in unauthenticated and non-connected responses. Test a blocked pair and an expired invitation. Test entitlement expiration and renewal at exact boundaries.
>
> Confirm network labels: ENSv2 Sepolia is separate from 0G Mainnet payment settlement. Check real transaction evidence, not just screenshots of a success toast.
>
> Audit the public repo for secrets, personal records, licensed assets, internal infrastructure details, and missing setup instructions. Preserve incremental history and planning artifacts.
>
> Produce a short evidence report, README setup instructions, known-limitations list, and a human-narrated demo script. Never mark an unexecuted test as passed.

## Configuration contract

Names below are proposed application variables, not vendor SDK option names.

| Variable / secret | Scope | Notes |
|---|---|---|
| APP_ORIGIN / MARKETING_ORIGIN | Server + selected public config | Actual owned domains; strict redirect allowlist |
| NEXT_PUBLIC_PRIVY_APP_ID | Public | App ID is not a server secret |
| PRIVY_APP_SECRET | Server secret | Only if required by selected server integration |
| DATABASE_URL or IAM connection config | Server | Follow verified Cloud SQL path |
| KMS_KEY_RESOURCE | Server config | Dedicated approved encryption key resource |
| PAYMENT_RECIPIENT | Server authoritative; public display | Checksum verified operator treasury |
| PAYMENT_DESTINATION_CHAIN_ID | Server authoritative | 16661 if demonstrated 0G Mainnet route |
| PAYMENT_ASSET_CONFIG | Server | Exact asset/decimals and verification method |
| PAYMENT_RPC_URL | Server secret/config | Approved endpoint, bounded retries |
| ENS_SEPOLIA_RPC_URL | Server config/secret | Separate client, chain 11155111 |
| ENS_V2_DEPLOYMENTS | Server/versioned public evidence | Verified canonical addresses and ABIs |
| ENS_PARENT_NAME | Config | Actual authorized parent, not guessed ownership |
| ENS_ISSUER_SECRET_REFERENCE | Server | Only if restricted issuance signer is necessary |
| SUPPORT_CONTACT / SELLER_DETAILS | Public configuration | Required before selling |
| ASSET_BUCKET / asset manifest | Server/public as appropriate | Authorized imagery and font injection |

The browser may need public RPC configuration for wallet interaction. Expose only intentionally public endpoints; never leak a secret server URL through a public-prefixed variable.

## Integration checkpoints

1. H2: written technical spike results. Payment support is proved or the exact gap is named.
2. H6: a deployed authenticated discovery/save slice with contracts stable.
3. H12: invoice/settlement/entitlement round trip, plus initial ENS namespace.
4. H18: two real accounts complete a consent-based connection.
5. H24: Framer → app → purchase → ENS → request → Now is coherent.
6. H30: critical tests and phone checks complete; optional work stops.
7. H32 onward: record demo, finalize evidence and submission.

Avoid describing these as effort estimates. They are points at which to cut scope or reassign attention.

## Evidence template

For each checkpoint report:
- Commit and deployed revision.
- User-visible behavior completed.
- Tests actually executed and results.
- Real external services exercised.
- Remaining failures and impact.
- Configuration or operator action still required.
- Rollback/recovery evidence for release changes.

Do not use “done” for a payment integration until a real authorized mainnet purchase is independently verified and grants exactly one entitlement.
