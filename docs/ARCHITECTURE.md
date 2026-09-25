# Architecture and invariants

## Deployment shape

Framer owns the apex marketing site. The Next application owns `app.<domain>`. This repository's homepage is a working visual/content reference and optional fallback, not a deployed Framer project. Send CTAs to the app origin; never pass bearer tokens in a URL or share app auth cookies with the apex.

The intended GCP shape is one dedicated Next process plus one worker on the existing GCE/PM2 environment, a dedicated PostgreSQL database and role, Secret Manager for server credentials, and KMS for contact envelope keys. It does not require Cloud Run, Kubernetes, Redis, a vector database or a custom token contract.

`src/app/api/[...path]/route.ts` delegates to framework-independent Web Request handlers. Services enforce permissions regardless of which screen calls them. PostgreSQL is authoritative for identity, content, membership and social state. Browser state never proves access or payment.

## Membership

- The plan is global. Entitlements have no city field.
- Access uses `startsAt <= now < endsAt`.
- Renewal starts at `max(now, latest endsAt)` and adds exactly 30 × 24 hours.
- Early renewal creates a future period. It does not reset the current period's ten-request quota.
- Quota counts requests made during their originating entitlement, including later cancellations or declines. This prevents cancellation from becoming an unlimited-outreach bypass.
- The free preview is an acquisition mode, not a second paid plan.
- Saved records, received requests and accepted contact access remain available after expiry. Full recommendation notes, directory discovery and new invitations/requests require active access.
- The schema is ready for other published cities. Neighborhood UI and initial onboarding copy are Tokyo-specific; adding city content alone is not a complete localization effort.

## Identity

`users.id` is stable and internal. The Privy subject is a unique authentication binding. Wallets are refreshed from the server-side Privy user record, not accepted as ownership proof from a request body. An address already linked to another app account cannot silently move. ENS resolves to a linked wallet; it never becomes the database primary key or transfers paid membership.

Public profile DTOs explicitly select allowed fields. Public lists never serialize authentication subjects, ciphertext, emails, Telegram handles or arbitrary wallet arrays. ENS labels expire after five minutes unless reverified. ENS lookup resolves again and refreshes the target account's provider wallet bindings before selecting a discoverable profile.

## Consent and moderation

Profiles default to private for real enrollment. The demo deliberately opts fictional profiles in to demonstrate discovery. Contact sharing has a separate explicit flag. Contact values are encrypted with a fresh AES-256-GCM data key and IV. KMS wraps the key in production; user ID is authenticated associated data for both layers. Demo keys are unsuitable for production and demo ciphertext is rejected outside demo mode.

A request identifies an immutable recipient account ID. Acceptance is recipient-only. Sender cancellation and recipient decline are separate actions. A canonical sorted account pair identifies an accepted connection. Both accounts are locked in consistent ID order to serialize reciprocal requests and blocks. A block hides profiles, invitations, request rows and shared contacts in both directions. Members can list and remove only their own blocks. Removing a stored contact immediately removes that shared access. Suspension prevents authentication and discovery; it closes active invitations.

The initial implementation has no in-app chat, push, email automation, exact location tracking, public online status, newsletter import or recommendation generation by an LLM. Contact reveal hands off to an explicitly supplied external channel.

## Payments

1. The server fixes plan/version and USD cents. It verifies the chosen source wallet belongs to the account.
2. A provider adapter must return an immutable destination obligation and quote expiry. Today only the local simulation returns a quote.
3. An invoice is unique by account and idempotency key. A second unresolved invoice is blocked to discourage duplicate purchases.
4. Browser callbacks submit only transaction/order hints. They never carry authoritative success or settlement evidence.
5. The worker independently inspects provider/chain evidence through the adapter, then checks chain, recipient, asset, base-unit amount, payer, quote binding, receipt success, finality and unique settlement identifier.
6. A transaction locks the account then invoice, inserts a unique settlement and unique invoice entitlement, advances paid-through and marks the invoice settled.
7. A worker lease expires after seven minutes. Retry backoff caps at five minutes; after twelve attempts or a terminal mismatch it goes to review. An admin may retry verification but cannot manually mark an invoice paid.

The destination evidence interface is an internal trust boundary. It is not an HTTP API. The 0G adapter must establish source-order-destination attribution itself; filling a struct with plausible values is not an integration.

The invoice `source_tx` uniqueness assumes one funding transaction per invoice in the chosen merchant route. If the provider uses one source transaction for multiple orders, revise the uniqueness model to the authenticated order/event binding before enabling that route.

## SQL and scale limits

20 tables plus migrations. Foreign keys, unique indexes and checks protect saves, canonical pairs, invoice idempotency, settlement replay and one-active-invitation behavior. Every application mutation writes an audit record without private message/contact payloads.

List reads are bounded: 60 places, 50 displayed members, 60 invitations, 100 request/admin rows and 200 saves. These are alpha limits, not a 60,000-user scale claim. The 60K numbers describe prior cumulative event attendance and the newsletter, separately.

Before importing 3,000 places, add cursor pagination and move recommendation ranking into a complete candidate-query strategy. Current ranking applies to up to 60 matching places. Before sending a large mailing-list launch, add capacity tests, connection pool sizing, edge limits and monitoring. Do not change the schema to store newsletter recipients as app members.

## Error handling

Mutations require the configured exact Origin. JSON bodies are streamed with a 16 KiB limit. Zod validates input. Per-account requests are capped at 120/minute; unauthenticated requests share 60/minute unless a trusted proxy identity is configured. Ingress should separately limit authentication attempts; the application limiter runs after authentication. Health and public config bypass that limiter.

Errors expose a safe code and correlation ID. Unknown exception objects are not printed. Payment and privacy services must not log token values, contact plaintext, RPC credentials or complete database URLs.
