# New Friendship Tech — Tokyo alpha specification

Version 1.0 · Research checked 25 September 2026  
Brand: New Friendship Tech · Presented by Urconduit  
Mode: Production controls, alpha product scope  
Status: Ready for implementation; live payment release depends on the verification gates below  
Build budget: 36 hours, solo operator supported by build agents  
Official submission deadline: 27 September 2026, 09:00 JST  
Recommended feature freeze: 27 September, 04:00 JST or hour 32, whichever comes first  
Canonical internal destination: jarvis/projects/builds/new-friendship-tech/SPEC.md

This document specifies the intended build. It does not claim an application, payment integration, deployment, or contract has already been implemented or tested. Read [BUILD-HANDOFF.md](BUILD-HANDOFF.md) for execution prompts, [FRAMER-PROMPT.md](FRAMER-PROMPT.md) for the marketing site, and [RESEARCH-AND-DECISIONS.md](RESEARCH-AND-DECISIONS.md) for sources and remaining uncertainties.

## 1. Product decision

Build a Tokyo connection companion: discover a place that suits you, find someone open to meeting, and make an actual plan.

The broader vision is a global connection superapp. The alpha proves one complete loop in one city. Places bring people into the product; trusted, consent-based connections give them a reason to return. The differentiator is New Friendship Tech's curation and real-world community, made useful between events.

Core promise: **Your people. Your places. Your next move.**

First audience: founders, builders, investors, operators, creators, and other travelers around Web3, crypto, AI, and technology. Membership is open to anyone. Professional categories help discovery; they are not admissions requirements.

The first successful session is a visitor signing in, getting a relevant Tokyo shortlist, saving a destination, and either posting a short-lived invitation or requesting a connection. Paid membership must visibly unlock useful functionality immediately. Access is global across all published cities; the first complete catalog is Tokyo.

### Outcomes and scope boundaries

| Outcome | Alpha requirement |
|---|---|
| Useful immediately | At least 24 genuinely curated Tokyo places; target 36; six useful free previews |
| Personal | Onboarding interests and neighborhood produce an explainable ranked list |
| Social | Opt-in profiles, connection requests, mutual acceptance, private contact reveal |
| Timely | “Right now” invitations expire automatically |
| Commercial | One global All Access membership; server-verified 0G Pay mainnet purchases |
| Web3-native | Working ENSv2 identity workflow on Sepolia, used in member discovery and connections |
| Presentable | Responsive marketing page and app using Aeonik Pro and the reference design language |
| Judgeable | Public source, reproducible setup, actual demo, integration evidence, development history |

Do not promise a citywide network, a full concierge service, guaranteed introductions, free dinners, verified investment opportunities, or live venue availability. Do not present the 3,000 Asia pins as already imported.

## 2. Brand truth and launch narrative

New Friendship Tech is technology that helps create new friendships. Its foundation is curated IRL events, distinctive hospitality, and connections across emerging technology and culture.

Use the two audience facts separately:

- **60K+ cumulative attendees across our events.** This counts attendance across events; it is not a count of unique people.
- **Approximately 60K newsletter subscribers.** This is the mailing audience, not registered app users.

Treat both as founder-supplied claims. Confirm the wording against the current newsletter dashboard and event records before publication. Never combine them into “120K members” or “60K people on the app.”

The supplied Seoul Web3 VIP Mixer & Deal Den material explains the brand's event-led community. It is not a Tokyo event listing. Use Seoul as a case study when approved imagery and accurate dates are available. Brand and artist collaborations can appear as selected historical work only when cleared for this use; do not suggest a current endorsement of the app.

Launch copy:

> New Friendship Tech helps you find great places, meet relevant people, and turn a new city into familiar ground. Starting in Tokyo.

Use “The plug for wherever you land” as a supporting line. Avoid NFT investment language: “NFT” is an ambiguous abbreviation for this brand. Prefer the full name or NFTech in navigation, metadata, and support.

## 3. Experience for somebody signing up today

### A. Free visitor to useful discovery

1. Arrive from an event QR code, personal invitation, or the homepage.
2. See “Tokyo alpha” and a concrete preview, with no wallet prerequisite.
3. Browse six public place previews and public event links.
4. Choose “Make Tokyo yours.”
5. Sign in with email; Google only if credentials are configured; existing wallet is another option.
6. Answer four small onboarding steps: interests, what they want to do, Tokyo neighborhood, and whether they want to meet people.
7. Receive a shortlist with reasons such as “Quiet place to work · matches your coffee interest · in your selected area.”
8. Choose a paid plan when trying to unlock the complete list. Keep the preview useful before checkout.

Budget, dietary/access needs, and stay dates are optional. Precise GPS is not needed. Do not force a professional biography just to browse places.

### B. All Access purchase

1. Select All Access, $19 for 30 days, covering every published city and all member features.
2. See exact source asset, network, quoted amount, fees, destination asset/network, merchant, and access period.
3. Connect a funded wallet or use the embedded wallet if funded. An empty embedded wallet must show that funding is needed; do not imply email login supplies money.
4. Approve/sign through the supported 0G Pay flow.
5. See “Confirming payment,” with persistent invoice status.
6. The server verifies settlement and grants access.
7. Land back on the personalized Tokyo list. Save places and open Google Maps for navigation.

A closed browser must not lose the purchase. On return, the account reads the same invoice and access entitlement.

### C. A member makes a plan

1. Use the same All Access membership to meet people; no second plan or city purchase.
2. Create an optional member profile with interests, short bio, role, and the neighborhood they choose to disclose.
3. Opt into member discovery. Private is the default.
4. Publish “Coffee in Shibuya” or browse current invitations.
5. Request a connection with a short reason and optional place/time.
6. Recipient accepts or declines in the app. Acceptance opens the contact method each party chose to share.
7. Continue in Telegram or another explicitly approved external channel.

There is no full chat, push notification service, or background location tracker in alpha. In-app request counters and deliberate refresh are sufficient. The interface must not imply a request has been read or delivered outside the app.

### D. ENSv2 passport

1. A member opens Profile → ENS passport.
2. They connect or select a wallet already verified as linked to their account.
3. They claim an available subname in the project's Sepolia ENSv2 namespace, if issuance is enabled, or link an existing Sepolia ENSv2 name.
4. The name resolves to that verified address. The member chooses whether to publish a limited public profile record.
5. Another signed-in member searches the name; the app resolves it and finds the opt-in profile.
6. A connection request targets the verified application account.

Names help find people. They do not grant paid access, prove a person's professional claims, or replace the account ID.

## 4. One membership, every city

**Latest product decision: one paid All Access membership. No city passes and no paid feature tiers.**

Price recommendation: **$19 for 30 days**, paid upfront, manually renewed. The same membership covers every published city and all released member features. Tokyo is the fully usable launch city; additional cities are included as they become available. Never imply that all 3,000 Asia pins or every city are already live.

| Access state | Price | What it delivers |
|---|---:|---|
| Free preview | Free | Six place previews per published city where available, public event links, own account/profile, receive and accept connection requests, link ENS identity |
| All Access | $19 / 30 days | Full published city catalogs, tailored recommendations, private saves, member discovery, ten initiated connection requests per access period, Right now, and ENS-enabled connections |
| Annual membership | Not sold in alpha | Later test approximately $149/year once recurring value is demonstrated |

The preview is acquisition, not a second paid plan. All members get the same released feature set. There is no Explore tier, Connect tier, city upgrade, or Circle upsell. A paid dinner or separately ticketed event can still cost extra, but that must be explicit at the event; membership is not a ticket guarantee.

The connection request quota controls spam and applies equally to all paying members. Receiving and accepting remains free so new relationships are not blocked by a second checkout. After a request is accepted, continued contact does not consume a quota or require another purchase.

### Why $19

Neighborhood Guide's Tokyo product costs $22 once for 250+ locations with permanent access. A list alone is a weak reason to renew. NFTech's subscription therefore sells continuing access to a useful network and evolving recommendations across cities, rather than a static guide.

Timeleft's published US example is $19.99/month for its booking subscription, with meals and drinks separate. That supports testing a sub-$20 connection product, although NFTech must prove its own network value. TripIt Pro's $49/year is another inexpensive traveler-utility benchmark.

$19 is a launch hypothesis, not validated willingness to pay. Hold the price steady through the first cohort and measure genuine use. Do not add an annual plan just to lock people into an unproven product. After retention is visible, test $149/year, with identical access and clearly disclosed renewal mechanics.

### Billing rules

- Store the price as integer USD cents; display the actual crypto obligation separately.
- Access begins at verified settlement and lasts exactly 30 × 24 hours.
- Renewal adds 30 days after the later of now or the current expiry. Serialize concurrent renewals per user; a prepaid future period does not reset the current request quota early.
- No automatic renewal, recurring debit permission, tier change, or city surcharge.
- Each invoice locks a price/version. Future price changes do not alter already purchased periods.
- Expiry retains the account, connections, and saved data. Paid discovery and new invitations become unavailable; receiving/accepting a request and viewing already mutually shared contact details remain available.
- The membership record is global to the account. Never attach city_id to an entitlement or require a second purchase when the user switches cities.
- A settled invoice grants access once. Refunds are operator-reviewed and recorded; the app has no treasury withdrawal key.
- Seller identity, support contact, access terms, and refund policy must be completed before live checkout.
- Copy: “All published cities. All member features. 30 days of access. No auto-renewal.” Add nearby: “Tokyo is live first. More cities are included as they launch.”

### What creates stickiness

| Retention loop | Alpha implementation | Follow-on after the hackathon |
|---|---|---|
| Your network travels with you | Connections belong to the account, independent of city | Opt-in upcoming-city overlap and introductions |
| Your taste compounds | Interests and private saves persist | Better ranking from explicit feedback, never covert tracking |
| There is something useful today | Current invitations and genuinely reviewed Tokyo recommendations | A consistent weekly curator update per active city |
| A new city does not mean starting over | Shared city schema and global entitlement | Publish Seoul and other cities when content is ready |
| Identity stays portable | Linked wallet and meaningful ENSv2 passport | Mainnet ENSv2 migration when officially supported |
| Membership produces real outcomes | Accepted requests and saved destinations | Opt-in feedback on whether people actually met |

Do not confuse stickiness with a feed that asks people to scroll. Optimize for useful places discovered, reciprocal connections, and plans made. Do not hide existing relationships when membership expires.

### Multi-city behavior

The app model is multi-city on day one even though Tokyo is the only fully published catalog. Each place/event/Now post has a city; each account, connection, entitlement, and saved library is global. People discovery can filter by a member's voluntarily selected current city. No precise location history is collected.

The city switcher lists published cities. A separate “Where should we go next?” section can gather interest without pretending a city is usable. Do not show five empty city dashboards just to look global. Onboarding may record an optional next-city interest, but do not collect exact future travel dates in alpha.

To publish another city later, an operator adds reviewed records, imagery, timezone, and editorial ownership, then changes its publication state. Existing memberships gain access automatically, without a billing migration.

### Operating economics

Planning example, not a forecast: 50 paid members produce $950 gross per 30-day purchase cycle. Among 500 active accounts that means 10% paid conversion.

Privy's observed Core price is $299/month at 500–2,499 MAU. If incremental cloud/RPC/logging costs are assumed at $100 and payment/refund expense at 5% of revenue, this example leaves $503.50 before founder labor, taxes, and other expenses. Replace these assumptions with actual account and route fees.

At $19 and the illustrative 5% variable expense, 23 paid purchases cover $399 fixed monthly spend before labor. Do not promise this margin: transaction costs and curation work may differ materially.

Start with a small opt-in Tokyo cohort and measure: first-session activation; seven-day return; saves per active member; accepted requests per request sent; repeat plans; renewal after day 30; and interest in a second city. A proposed first-cohort target is 40% activation and 25% seven-day return, explicitly an internal target rather than an external benchmark. Newsletter size is distribution potential, not retention evidence.

## 5. Feature contract

P0 means required for the intended alpha. P1 means only after every P0 gate is green. Deferred means do not begin within this build.

| Feature | Priority | Acceptance |
|---|---|---|
| Landing page and app shell | P0 | Main CTAs reach working app routes; usable at 360–1440px |
| Email/external wallet sign-in | P0 | Refresh restores session; server verifies identity |
| Tokyo onboarding | P0 | Choices persist and change ranking |
| Curated place discovery | P0 | Public six-place preview and server-gated full catalog |
| Saves | P0 | Account-owned saves survive refresh |
| Membership and verified payment | P0 | Real purchase produces one entitlement after settlement |
| Profiles and connection requests | P0 | Opt-in visibility, accept/decline, consent-based contact reveal |
| Right now | P0, deliberately small | One active invitation/member, expiry, request-to-connect action |
| ENSv2 passport and lookup | P0 for ENS prize | Real Sepolia reads and writes; functional member lookup |
| Tokyo events | P0, deliberately small | Manually curated official links and dates; external registration |
| Admin and moderation | P0 | Authorized place/event edits, report review, block/suspend, invoice lookup |
| Rich interactive map | P1 | Only if licensed coordinates and integration are ready |
| Shared public collections | P1 | Explicit share control; revoke link; no private data leakage |
| AI concierge | P1 | Read-only recommendations from real place IDs; no autonomous spending |
| Other city content / 3,000-pin import | Deferred | Multi-city schema now; publish reviewed city catalogs later without additional charges |
| Messaging / group rooms | Deferred | Use mutual contact handoff |
| Warm-path relationship graph | Deferred | Requires real relationship data and consent |
| Social credit / standings | Deferred | Requires abuse-resistant provenance and a defensible scoring model |
| Custom event ticketing / scanning | Deferred | External registration now |
| Auto-renewal / annual billing | Deferred | Requires supported mandate and lifecycle handling |
| Native mobile / live location / background tracking | Deferred | Responsive web now |
| Company directory / editorial newsroom | Deferred | Too little supporting data for alpha |

### Onboarding

Required: chosen display name, interests (up to five), intent (up to three), initial active city Tokyo. Neighborhood can be “Anywhere in Tokyo.” Optional: role, budget band, accessibility preferences, language, visit dates.

Step four is a separate consent switch: “Make my profile discoverable to members.” Default off. Contact sharing has its own choice. Newsletter consent is separate, optional, and never preselected.

Persist partial completion. A returning account resumes without repeating wallet creation or payment.

### Places

Categories: Eat, Coffee, Drink, Work, Culture, Outdoors, Meet. Tags can overlap. Neighborhood vocabulary starts small and is data-driven; only show areas with actual content.

Each published place needs: stable ID/slug, name, neighborhood, category, original curator note, why it is useful, use-case tags, Google Maps URL, source, last review date, publication state, and optional price band/photo. Coordinates, hours, accessibility, dietary suitability, Wi-Fi, and reservation notes are nullable and must never be invented.

A place page includes “Why we picked it,” “Good for,” curator context, Save, and Open in Google Maps. Unknown hours show “Check current hours.” An editor's recommendation is distinct from verified operational information.

Do not scrape Google ratings, reviews, or photos. Start with the founder's own descriptions and authorized images. A manual Tokyo seed avoids making Google account export and place matching dependencies.

Ranking: hard-filter explicit categories/neighborhood; score remaining places with transparent rules such as +3 interest match, +2 intent match, +1 preferred area, +1 editorial pick. No location-based distance score without valid coordinates and user permission. Sort ties predictably. Display two true reasons per recommendation. This satisfies “tailored” without an LLM.

At least six strong recommendations should be visible in the first useful result, with honest “broaden your filters” behavior if fewer match. Unknown allergy/accessibility data never counts as a match.

### People and requests

A discoverable profile contains name, short bio, role, interests, city, optional broad neighborhood, optional ENS label, and self-selected “open to” intents. Exclude exact lodging, travel dates, email, phone, Telegram, and wallet balance from directory responses.

Badge semantics:
- “Wallet linked”: cryptographic control or trusted auth-provider linkage established.
- “ENS linked”: current resolution matches a linked address.
- “Host”: administrator assigned role.
- Self-described founder/investor titles are not verified credentials.
- Do not ship “trusted,” “vouched,” or “verified investor” labels without a concrete process.

A request has sender, recipient, context, optional place/time, and status pending/accepted/declined/cancelled/expired. Prevent self-requests, duplicate pending requests, and blocked pairs. Pending requests expire after seven days. Initiation quota is enforced transactionally; an accepted connection need not be re-requested.

Request copy is capped at 280 characters; no attachments or arbitrary HTML. Acceptance reveals only each person's expressly opted-in contact fields to the other. Declining does not reveal contacts. A contact cannot become public merely because someone is paying.

If the other member has not added a shareable contact, show that honestly and let them complete their own setup. Alpha is for adults; avoid collecting birth dates—use an age eligibility attestation consistent with the eventual terms.

### Right now

This is the strongest screenshot idea to retain.

Fields: Coffee/Food/Drinks/Work/Walk/Event/Business; broad neighborhood; optional curated venue; start time; expiry; 140-character note. One active post per All Access member. Default two-hour expiry, maximum six hours; all comparisons server-side.

No live map of people. List current invitations with a clear time remaining and “Request to join,” implemented through the same connection request service. Do not create a second chat, RSVP, or capacity-management engine. Expired invitations disappear from discovery, remain in the owner's history briefly, and cannot receive new requests.

An empty feed says “Be the first to make a plan in Tokyo.” Never seed fictional people into production.

### Events

Manually curate genuine Tokyo events with event name, venue/area, start/end, timezone, organizer, source URL, registration URL, last checked time, and access note. Store UTC timestamps; render Asia/Tokyo and show JST.

Registration is an external official link. “Save” is a bookmark; it does not imply a reservation. Display “Registration required,” “Approval required,” or “Check organizer details” when appropriate. Do not infer availability or import the Seoul mixer into Tokyo.

Target three to five verified upcoming events if they exist. A truthful empty state is acceptable when none can be verified. Avoid inventing an event to fill a card.

### Admin

One role-checked admin surface: place/event CRUD, content publication, report queue, user suspension, and invoice/entitlement inspection. User-data writes use applyWrite and produce redacted audit events.

No broad SQL console, wallet impersonation, editable “payment succeeded” toggle, or arbitrary entitlement override disguised as a purchase. Explicit complimentary grants may exist for approved demos and hosts, with reason, expiry, and audit trail. They are not payment proof.

## 6. Information architecture and screens

Marketing origin is DOMAIN_TBD; app is app.DOMAIN_TBD. Domain ownership has not been supplied. Use configuration variables, not a guessed live domain.

| Route | Screen and primary job |
|---|---|
| Marketing / | Explain value; preview Tokyo; plans; enter app |
| App / | Redirect to /tokyo |
| /tokyo | Personalized Explore list and immediate intent actions |
| /tokyo/places/[slug] | Place detail, save, directions |
| /tokyo/people | Opt-in directory, filters, ENS lookup |
| /members/[id] | Authorized profile and request action |
| /tokyo/now | Current invitations and own post editor |
| /tokyo/events | Official event listings and bookmarks |
| /saved | Private saved places/events |
| /requests | Received/sent requests and contact handoff |
| /onboarding | Resumable four-step personalization |
| /membership | Current plan, exact expiry, purchase/renewal options |
| /checkout/[invoiceId] | Quote, wallet flow, durable payment state |
| /settings | Profile visibility, contacts, linked wallets, ENS, consent |
| /admin | Role-restricted operations |
| /privacy and /terms | Completed operator-specific policies |

Marketing owns storytelling. The app owns identity, member content, checkout, and entitlements. Framer never receives an auth secret or payment verification authority. Do not put tokens in cross-domain URLs. Validate any returnTo parameter as an allowed relative path.

## 7. Design system and responsive behavior

### Reference interpretation

The supplied TBD Studio site is the primary visual reference: near-black canvas, large editorial grotesk typography, framed grayscale imagery, thin borders, rounded frames, acid-lime highlights, compact utility labels, restrained numbered layouts, and strong image/text contrast.

Its live desktop layout was visually inspected. Its published responsive CSS was inspected and uses mobile below 810px, tablet 810–1199px, and desktop at 1200px+. A live mobile viewport capture was not available in this research session; mobile visual comparison is an explicit build QA task. The responsive specifications below are authored requirements, not claims that every reference component was visually verified on a phone.

The old screenshots are functional inspiration. They do not override this visual direction or the new open-membership decision. Keep the Right now concept, people/place/event cards, and request structure. Remove the oversized sitemap, admissions gate, social-credit rankings, relationship graph, and empty intelligence sections.

### Shared tokens

| Token | Value / rule |
|---|---|
| Font | Aeonik Pro for all authored text, including labels and numerals |
| Background | #050505 |
| Surface | #101010; raised surface #181818 |
| Primary text | #E8E8E8 |
| Secondary text | #A3A3A3; confirm contrast on actual surface |
| Accent | #C7FF97 with #101010 text |
| Border | White at approximately 14% opacity; visible focus state separate |
| Error / warning | Accessible text + icon; never color alone |
| Width | Marketing maximum 1440px; content grids respect readable line lengths |
| Gutters | Desktop 32px, tablet 24px, mobile 16px |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64, 96px |
| Radius | Hero 32px desktop / 20px mobile; card 16px; control 10px; chip pill |
| Controls | At least 44px touch target; primary buttons normally 48px |
| Body | 16px, line-height around 1.5 |
| Small text | 12–14px; do not copy unreadable 9px reference labels |
| App heading | 32px mobile / 40px desktop |
| Marketing hero | Fluid approximately 48–96px, tight but legible leading |
| Motion | 150–250ms interaction feedback; modest section entry; reduced-motion support |

Obtain licensed Aeonik Pro webfont files and rights for both marketing and app domains. Do not assume font binaries may be committed to the public repo. Use a documented asset-injection path and a generic development fallback; the deployed branded build should use the supplied font. If Japanese text appears, use the system's Japanese glyph fallback only where Aeonik lacks glyphs.

Third-party wallet/payment surfaces may have font limits. Theme through supported APIs, isolate any unavoidable exception, and never alter wallet security information to enforce the font rule.

### Marketing components

Header with wordmark, Tokyo / How it works / Membership anchor links, Log in, and one primary CTA. Mobile replaces links with a working menu sheet.

Hero: founder-supplied Tokyo image, dark overlay and restrained grayscale treatment, thin inner frame, large headline with one lime emphasis, concise copy, and white/lime action treatment. The place and people content remains the focal point; no stock blockchain or floating coin decoration.

Proof: two separate metrics with accurate labels. A heritage section can show selected past events; no fake app growth counters.

Product preview: authored screenshots or real app content depicting places, opt-in people, and Right now. Decorative demos must be labeled as previews until replaced by the actual app.

Pricing: one All Access offer, clear 30-day period, no annual/monthly toggle, no city-specific checkout. FAQs must explain wallet funding, no auto-renewal, Tokyo-first content and global membership coverage, privacy, and separate event registration.

Footer: New Friendship Tech, “Presented by Urconduit,” support, policies, and authorized social links.

### Responsive contract

| Component | Desktop ≥1200 | Tablet 810–1199 | Mobile ≤809 |
|---|---|---|---|
| Landing hero | Image/copy framed composition; large type | Reduced type and rail spacing | Single-column text and image crop; no sideways overflow |
| Landing navigation | Inline links and CTA | Compact links | Menu sheet with focus management |
| Proof metrics | Two balanced panels | Two panels | Stack without merging labels |
| Places | Three-card grid or two-column list | Two cards | One card; clear save and directions actions |
| App navigation | Top navigation and account menu | Compact top navigation | Bottom nav: Explore, People, Now, Events, Saved; profile via header avatar |
| Filters | Visible chip row, expandable panel | Compact chip row | Filter button opens bottom sheet; selected count and clear action |
| People | Three columns | Two columns | One column with concise profile cards |
| Place/profile detail | Main content plus action rail | Narrower rail or inline actions | Inline content; one sticky primary action where useful |
| Right now | List with separate compose card | Compose above list | Full-width list; compose sheet |
| Requests | List/detail split when space permits | Single list | Stacked request cards |
| Membership | Single All Access offer and benefits | Single full-width offer | Single card, no horizontal pricing carousel |
| Checkout | Centered panel and purchase summary | Same | Full-width panel, safe-area spacing; no clipped wallet modal |
| Tables/admin | Real table | Horizontal table wrapper if necessary | Cards or scroll wrapper limited to table; page never scrolls sideways |

Use 360, 390, 768, 810, 1024, 1200, and 1440px checkpoints. Test mobile keyboard, safe-area bottom padding, long ENS names, long place names, 200% zoom, and orientation change. Bottom navigation must not cover sticky checkout actions.

All controls need accessible names and visible focus. Sheets/dialogs trap focus, close with Escape where appropriate, and restore focus. Loading skeletons preserve layout; errors offer a specific retry or recovery; empty states explain a next action. Support system reduced motion.

Do not silently flatten the reference into a generic SaaS dashboard. Keep the typography, editorial framing, quiet dark palette, and lime accents consistent across both surfaces.

## 8. Application architecture and GCP deployment

Follow the supplied GCP operating model, with explicit product overrides:

- Framer replaces the document's Webflow default because the user chose Framer.
- Aeonik Pro replaces Geist and Geist Mono because the user chose Aeonik Pro.
- Use Node 22 LTS, latest compatible patch pinned after the SDK spike. Node 20 is EOL at this research date.
- Use Next.js 16+, TypeScript strict mode, Tailwind, Drizzle, PostgreSQL 16.
- Run the app's Next.js routes under PM2 on the established GCE path; do not make a Cloud Run migration part of the hackathon.
- Use a dedicated database, database role, runtime identity, and PM2 process for this product, even if an existing approved VM/SQL instance is reused.
- Consult private infra-ops for verified host mappings and permissions. Do not publish the supplied infrastructure document, existing project identifiers, billing account, machine addresses, or operator identities in GitHub.
- Region follows the established app/database co-location, currently us-central1. Measure Tokyo latency before contemplating a regional migration.

Architecture: Framer marketing → Next.js app/API → Cloud SQL. Privy provides authentication and wallet provider access. Separate chain clients handle ENSv2 Sepolia and payment settlement. A durable payment worker polls provider/chain evidence. Cloud Storage holds authorized assets; Secret Manager holds runtime secrets; KMS handles sensitive encrypted data.

~~~mermaid
flowchart TD
  M["Framer marketing"] --> A["Next.js app and API"]
  A --> I["Privy identity"]
  A --> D["PostgreSQL"]
  A --> E["ENSv2 on Sepolia"]
  A --> P["0G Pay checkout"]
  W["Payment worker"] --> P
  W --> R["Mainnet settlement RPC"]
  W --> D
~~~

Marketing links into the app; it receives no private session or payment authority. The worker grants access only after verifying the selected payment route.

One app service and one small worker process are sufficient. Do not introduce microservices, Redis, a graph database, a vector database, Kubernetes, or a separate API framework.

### Auth

Privy is the default because its embedded-wallet/social-login UI fits the deadline and it supports EVM chain configuration. ENS compatibility comes from the provider and chain client; it does not require a special ENS login vendor.

Use the chosen current Privy SDK's documented server token verification. Upsert a stable UUID keyed by unique Privy subject. Derive the acting user from the verified session, never from a request body. Linked wallets must come from verified provider data or a correctly nonce-bound ownership challenge, not an arbitrary form field.

Use host-only secure application sessions where supported; verify origin/CSRF for cookie-authenticated mutations. Rate-limit authentication and connection writes. Sign-out clears application state. Linking a wallet must not merge unrelated accounts automatically.

Separate user ID, wallet address, ENS name, role, and membership. Changing a display name or transferring an ENS name must not transfer the user account or paid entitlement.

### Operational baseline

Use Secret Manager from the first commit. Local example files contain variable names and placeholders only. Runtime identity gets only the required database, secret, storage, and KMS access. No service-account JSON or wallet private key in GitHub.

Structured logs contain correlation IDs and safe event identifiers. Do not log auth tokens, decrypted contacts, full bios, payment signatures, or secrets. Metrics: auth error rate, API latency, 5xx, pending invoice age, settlement mismatch, entitlement activation failure, worker heartbeat, database connections.

Readiness checks verify database access and required configuration. Chain outages should degrade the affected feature, not break browsing. A health endpoint returning 200 alone is not a deployment smoke.

Use release directories or an equivalent atomic build switch, preserve the last working build, and run only one Next.js build at a time. Apply additive migrations, inspect generated SQL, back up before production schema changes, and verify the migration journal. Rollback application code without attempting to erase settled payments.

GCP costs must come from the chosen actual resources. Existing shared infrastructure is not “free.” Budget alerts and a small alpha enrollment cap are part of launch configuration.

## 9. ENSv2 integration specification

The researched ENSv2 beta is on **Ethereum Sepolia, chain 11155111**. It is separate from live payment settlement on 0G Mainnet. The ENS partner track requires real, central functionality; a decorative .eth badge is insufficient.

### Functional target

“NFTech Passport” combines a project-controlled subname namespace, member-controlled public records, and ENS-based lookup into the consent-based connection flow.

Use official ENSv2 contracts and factories; do not write a paid registrar or put mainnet customer funds into experimental ENSv2 code. Choose an available project parent during implementation. The spec does not assume ownership of nftech.eth or any other name.

Implementation sequence:

1. Pin an ENSv2-capable viem release and documented ABIs; record the exact versions.
2. Read canonical Sepolia deployment addresses from current ENS documentation; verify chain ID and deployed bytecode.
3. Prove independent resolution of a test name before building a custom claim UI.
4. Obtain/control a parent and deploy/configure a supported subname registry and appropriate resolver, using the official tutorial.
5. Create at least two genuine, consented member names for the demo.
6. Configure record permissions deliberately. Possession of a subname must not be assumed to confer permission on a shared parent resolver.
7. Let a member update a permitted public record and verify the result through a fresh read.
8. Use normalized name → resolved address → verified linked wallet → opt-in account lookup to initiate a request.

A small issuance endpoint may allocate a subname only after authentication, uniqueness validation, and a linked-wallet check. It is restricted to the project's namespace, rate-limited, and limited to testnet resources. If this signer is server-side, its Secret Manager secret and role are isolated from the payment treasury; it must never be a general-purpose signing API. Prefer a one-time operator-issued namespace setup and narrowly scoped issuance permissions.

### Public record policy

Allowed records: selected display name, public avatar URL, a short public description, and an explicitly public profile URL. Publishing is opt-in, with a clear note that public chain records persist.

Do not publish email, Telegram, exact location, trip dates, private interests, connection history, paid membership, or private profile URLs. The normal member profile stays access-controlled. A public ENS profile page, if implemented, serves only the separately approved public projection.

Identity links persist chain ID, normalized name, labelhash/namehash as appropriate, resolved address, registry/resolver source, last verification time, and status. Do not use mutable token IDs as permanent name identity. Read the current resolver before record writes; do not hardcode a per-name resolver forever.

Forward-verify reverse names before showing them as an identity. Use safe avatar handling, HTTPS restrictions, bounded fetches, and protections against private-network fetches for avatar/CCIP resources.

### Transfer, failure, and ownership behavior

Re-resolve at link time and before name-based connection actions, with a short cache. Freeze the resolved recipient account in the created request. Name transfer cannot redirect old requests or reveal another person's contacts.

If resolution changes or fails, mark the name stale and remove the verified ENS label until reverified. Do not delete the account. A testnet reset should not affect mainnet paid access.

Both clients carry explicit chain configuration. Never use the current wallet network as the implicit chain for server reads. Explain wallet network switching at the action, then restore the appropriate payment source network when paying.

### ENS acceptance

A judge can resolve a real ENSv2 name, see its opted-in profile, send a request, update a permitted record from the authorized wallet, and see the changed value after a fresh read. An unauthorized wallet cannot write that record. Document deployed addresses, transactions, ABIs, permissions, and the specific v2 capability used.

If issuance automation slips, use genuinely provisioned names and a functional link/edit/lookup experience. If ENSv2 itself does not work, retain useful mainnet ENS support if available but do not claim ENSv2 prize eligibility.

## 10. 0G Pay and real-money membership

### Verified capabilities and unresolved edge

The public 0G Pay docs describe funding flows; the SDK documents developer mode and a custom recipient. The inspected stable SDK release was 0.2.1. It accepts an EIP-1193 provider and offers crypto/card methods; set crypto only.

The documented REST prepare request exposes source chain, token, amount, and sender, but no custom merchant recipient field. Therefore, do not assume its deposit flow is interchangeable with SDK developer-mode checkout. Public docs also do not establish recurring membership billing or a trustworthy merchant webhook.

There is a callback mismatch worth testing: the inspected internal modal has exact-output callbacks, while the exported OGPay props expose the swap callbacks. A prefilling prop is not an immutable invoice. The build must prove the actual pinned SDK path instead of inventing callback names or treating the browser's success event as settlement proof.

No real payment was executed in this research. A health endpoint responded, which establishes connectivity only.

### Payment contract

The product sells access in USD-denominated amounts, settled through a narrowly supported 0G Pay mainnet route. Official 0G Mainnet chain ID is 16661. Resolve supported assets, output denomination, contract addresses, provider order evidence, and finality behavior during the first spike.

Use developer mode, explicit treasury recipient, and methods set to crypto. Do not accidentally top up a user's AI credit balance or the default 0G recipient instead of collecting membership revenue.

Before enabling purchases, the payment agent must demonstrate all of these:

| Gate | Required evidence |
|---|---|
| Merchant destination | Mainnet settlement reaches the configured treasury with the expected asset |
| Amount meaning | Exact base-unit obligation and quote conversion are understood and shown correctly |
| User attribution | Payment intent/source transaction can be bound to the authenticated member's verified wallet |
| Provider linkage | Quote/order/source and settlement records can be correlated without trusting browser claims |
| Independent settlement | Server can verify recipient, asset, chain, amount, successful receipt, and finality |
| Idempotency | Same order/settlement cannot activate two invoices or accounts |
| Recovery | Browser close and worker restart still activate a valid purchase once |
| User control | Rejection/cancellation never spends again automatically |
| Cost | Gas, route fees, slippage behavior, and support/refund path are known |

If cross-chain attribution cannot be proved in time, restrict the offered flow to one SDK-supported route that can be independently verified. Do not advertise arbitrary-chain payments. If no supported route meets these gates, checkout stays disabled; this means the requested paid alpha is not yet complete. Do not label a client callback, an admin grant, or a testnet transfer as a successful mainnet integration.

### Invoice lifecycle

Created → quoted → awaiting signature → submitted → confirming → settled → entitlement active.

Other states: quote expired, user cancelled, failed, underpaid, refund pending, refunded, review required. “Timeout” from a provider is not equivalent to payment failure; the transaction may still settle.

Server invoice fields:
- Invoice UUID and authenticated user UUID.
- Plan/version and USD cents.
- Source wallet, chain, asset, expected amount/limit where applicable.
- Destination chain, asset, merchant recipient, minimum required amount.
- Quote identifier, provider order identifier, and expiry.
- Source transaction, destination settlement reference, observed block/finality.
- Status, timestamps, idempotency key, verification evidence hash/reference.
- Single linked entitlement grant and support resolution record.

Use arbitrary precision integer/base-unit handling for tokens. Never JavaScript floating-point money. The destination amount is fixed for the accepted quote. Show quote expiration; regenerate before a new signature if stale. Do not silently requote a submitted transaction.

For a native-token price, require a documented quote/conversion source and a bounded timestamp; never hardcode a guessed USD/0G exchange rate. USD amount, token obligation, and fees must be distinguished.

### Verification and polling

The server owns the invoice. The client may submit an order/transaction hint, but every field is untrusted until verified. For cross-chain settlement, the destination sender may be a solver; do not equate destination transaction.from with the customer's wallet. Verify the source-to-order-to-destination linkage.

A durable SQL job table and worker lease are sufficient. Apply an atomic lock and unique settlement constraint before granting access. Invoice settlement, entitlement insert, and redacted audit row commit together. Repeating the operation returns the existing result.

The documented REST order endpoint can long-poll for up to five minutes and is limited to five requests per five minutes per IP. The prepare/confirm endpoints are documented at ten per minute. Treat these as ceilings for that API, not proof that SDK developer-mode uses the same endpoints. Do not let every browser hit those endpoints every few seconds. The app polls its own cached invoice status; the worker performs bounded upstream requests, backoff, and reconciliation.

Record both source and destination evidence for support. A block explorer link is useful to a customer, but the server must verify through trusted RPC/provider evidence. For native-value transfers, a successful receipt alone is insufficient; verify the actual value transfer to the treasury using the route's documented settlement mechanism.

Late settlement is reconciled against the original quote and obligation. Exact or sufficient settlement activates the purchased term once; underpayment requires support and no automatic access. Overpayment policy is explicit and recorded. Never automatically initiate a second payment because the first is slow.

### Release and refund operations

Use a founder-approved small real purchase through the same production path as a customer. Verify the receipt, entitlement, restart recovery, and replay rejection. Do not secretly reduce the invoice amount while claiming a standard-price purchase.

Keep an independent checkout kill switch that blocks new invoices while continuing reconciliation of submitted transactions. Treasury withdrawals/refunds are performed through the authorized operator wallet, with a record in the app. A refund path must not mean the app server gets custody.

## 11. Data model and API boundaries

Use UUID primary keys, timestamptz, explicit foreign keys/delete behavior, and indexes on account ownership, status, expiry, city, and commonly filtered fields.

| Entity | Essential fields and constraints |
|---|---|
| users | UUID, unique auth subject, display name, account status, onboarding state |
| profiles | user ID, role, short bio, interests, intents, city, broad area, visibility, public projection opt-in |
| private_contacts | user ID, encrypted payload, wrapped DEK, sharing choice, updated time |
| wallet_links | user ID, normalized address, chain namespace, verification method/time; controlled conflict handling |
| ens_identities | user ID, chain ID, normalized name, stable name hashes, resolved address, verification/status |
| cities | slug, name, timezone, publication state; only Tokyo published |
| places | city, slug, original notes, category/tags, map link, nullable factual fields, provenance, review date |
| events | city, title, UTC dates, source/registration URLs, access note, publication state |
| saves | user ID, typed target ID; unique user/target |
| connection_requests | sender, recipient, context, optional place/time/intent, state, expiry; duplicate-pending prevention |
| connections | canonical ordered pair, accepted time, visibility/contact consent state |
| now_posts | owner, city/area, kind, note, optional place, start/expiry, state; one active per owner |
| plans | stable key, version, cents, period length, capabilities, sale state |
| invoices | purchase contract and verification fields from section 10 |
| payment_settlements | unique chain + provider settlement/transaction event identity; evidence; invoice ID |
| entitlements | user, global plan version, starts/ends, source invoice or audited complimentary grant; no city scoping |
| quota_usage | user + entitlement period + action; atomic counter or constrained event ledger |
| jobs | kind, status, run-after, lease owner/expiry, attempts, safe payload reference |
| blocks / reports | actor, subject, reason code, workflow state |
| audit_log | actor/system identity, action, entity ID, time, correlation ID, redacted change summary |

Account deletion immediately hides profiles and cancels public invitations. Financial/audit record retention is a separate policy, not a cascading deletion accident. Keep public content deletion and payment evidence retention explicit.

Endpoint families:
- POST /api/session, GET /api/me, PATCH /api/me/profile
- GET /api/places, GET /api/places/[id], POST/DELETE /api/saves
- GET /api/members, GET /api/members/[id], POST /api/requests
- POST /api/requests/[id]/accept or /decline or /cancel
- GET/POST /api/now, DELETE /api/now/[id]
- GET /api/events
- GET /api/plans, POST /api/invoices, GET /api/invoices/[id]
- POST /api/invoices/[id]/submit, GET /api/entitlements
- POST /api/ens/link, GET /api/ens/resolve, POST /api/ens/claim when enabled
- POST /api/reports, POST /api/blocks
- Role-protected /api/admin/*

Define Zod input/output schemas and generated/shared TypeScript types before feature work. Every user-owned read/write enforces ownership. Every paid API checks active entitlement server-side. A locked UI is not authorization.

Return a consistent error envelope with code, safe message, retryable flag, and correlation ID. Use 401 for unauthenticated, 403 for forbidden, 404 for unavailable/private resources where appropriate, 409 for state conflicts, 422 for validation, and 429 for rate limiting.

Pagination is cursor-based or bounded page-size; no unbounded member export. Public place previews must not embed the full paid catalog in HTML, client JavaScript, or a public static JSON seed.

## 12. Production controls, privacy, and abuse

This is a production-mode application because it accepts payments and personal data. Scope can be small; the money and authorization paths cannot be pretend.

### Data inventory

| Data | Visibility | Storage decision |
|---|---|---|
| Auth identifiers | Private | Minimal verified identity; database transport/storage encryption |
| Email | Private | Prefer provider-held email; store only if a concrete feature needs it |
| Bio/interests/role | Opt-in member directory | Plain application fields with access controls; user-editable |
| Private contact method | Mutually accepted parties only | KMS envelope encryption: per-row DEK and authenticated encryption |
| Neighborhood | Optional member-visible | Broad area only; no background location |
| Stay dates/preferences | Private | Avoid collection unless used; never on chain |
| Payment evidence | Private account/admin | Retained for reconciliation; public chain links disclosed deliberately |
| ENS public records | Public blockchain | Explicit opt-in and minimum field set |
| Newsletter consent | Private | Separate boolean + timestamp/source; no automatic newsletter import |
| Reports | Moderators | Restricted access; redact logs |

Do not persist OAuth refresh tokens unless required. If required, apply KMS envelope encryption. No general-purpose file uploads in P0; use approved seed assets and supported avatar mechanisms to avoid a rushed upload security surface.

### Threats and required controls

| Threat | Control |
|---|---|
| Client forges membership | Server verification and server entitlement checks |
| Transaction replay | Unique settlement identity and atomic grant |
| Wrong chain/recipient/token | Strict configured allowlists and evidence validation |
| Wallet/name takeover | Stable app UUID, verified wallet linking, ENS revalidation, no automatic account transfer |
| Profile/contact scraping | Opt-in directory, pagination/rate limits, contacts absent from directory payloads |
| Unwanted contact | Mutual acceptance, block/report, immediate enforcement on queries/actions |
| Injection/XSS | Schema validation, escaped text, no arbitrary HTML |
| SSRF via avatar/resolver URL | Bounded approved fetch paths, private-network blocks, content limits |
| Admin escalation | Server-side role checks, explicit assignment, audit |
| Secret disclosure | Secret Manager, repository scanning, no sensitive logs |
| Dependency failure | Timeouts, bounded retries, durable pending state, per-feature switches |

Initial retention proposals: diagnostic logs 30 days; expired Right now content 30 days; rejected/expired request text 90 days; deleted-account personal fields purged within 30 days where feasible. Financial/audit retention must be set by the operator for the seller's jurisdiction before launch. These are product defaults, not legal conclusions.

No personalized investment advice, matchmaking guarantees, social-credit score, or autonomous user spending. The platform helps consenting adults arrange their own meetings.

## 13. Verification and release criteria

Concentrate tests on failures that could lose money, disclose private information, or break the core loop. Do not spend the deadline snapshot-testing decorative components.

Required:
1. Auth/session integration and cross-account ownership checks. Exercise authorization and validation on every public endpoint through a reusable integration harness.
2. Entitlement expiry boundaries, renewal arithmetic, and global access across published cities.
3. Payment verifier rejects wrong recipient, chain, asset, amount, unfinalized settlement, and another user's transaction.
4. Duplicate callbacks, worker retry, and parallel requests produce one grant.
5. Browser close and worker restart recover a submitted valid invoice.
6. Private contacts never appear in list/profile responses before acceptance.
7. Blocked members cannot request, see disallowed details, or respond to Now posts.
8. Right now expiry is enforced by the API without relying on a browser timer.
9. ENS linking rejects an unowned address; transfer/stale resolution does not redirect old requests.
10. Real ENSv2 record read/write succeeds and unauthorized write fails.
11. A real 0G Pay mainnet purchase completes on the selected production path.
12. Mobile sign-in, wallet interaction, payment status, and keyboard behavior work on an actual phone.

Smoke deployed routes with a fresh account, an existing account, a paid account, and an unauthorized account. Verify a real database write and refresh, not just status codes. Check the rollback route and that reconciliation survives restart.

Targets, to measure rather than claim: core app interactions feel immediate; cached catalog APIs typically under 800ms from Tokyo; useful content within 2.5 seconds on a reasonable mobile connection; no layout shift from unloaded images/fonts; no horizontal page overflow. Record actual results and device/network conditions.

Live release requires: valid seller/support configuration, authorized treasury, payment evidence, working entitlement checks, privacy controls, verified deployment, available rollback, and public repo hygiene. Disable only the unready feature; document any resulting alpha requirement that remains unmet.

## 14. 36-hour execution plan

These are deadline checkpoints, not promises that each dependency takes a fixed number of hours. The official submission deadline overrides the relative clock.

| Window | Deliverable | Exit gate |
|---|---|---|
| H0–H2 | Repo/spec scaffold, Privy sign-in, ENSv2 read/write spike, 0G developer-mode proof | Identify supported payment route and server evidence; exact dependencies pinned |
| H2–H6 | Schema, API contracts, session, entitlement core, design tokens, Tokyo seed | First deployed vertical slice: sign in → browse → save |
| H6–H12 | Payment worker and invoice UI; place discovery and onboarding; ENS namespace | Verified purchase in controlled test; usable Tokyo list |
| H12–H18 | People, requests, contact consent, minimal Right now; events | Two real accounts complete a connection |
| H18–H24 | ENS lookup integrated into requests; Framer homepage connected; admin | End-to-end branded journey |
| H24–H30 | Failure tests, real mainnet rehearsal, phone testing, content corrections | Required money/privacy/identity gates pass |
| H30–H32 | Freeze features, improve errors and polish, repository documentation | Demo candidate tagged |
| H32–H36 | Record 2–4-minute demo, complete submission, monitor and fix blockers | Submission accepted before official cutoff |

First cut: interactive map, AI concierge, shared collections, animation extras. Next cut: Google OAuth if email/external-wallet login works; elaborate admin styling; automated namespace issuance if real link/edit/lookup remains. Never cut server payment verification, contact privacy, or truthful chain labeling.

If payments are unresolved at H2, assign the payment work priority and freeze optional scope. If still unresolved at H6, document the precise missing evidence and keep purchases disabled while the agent resolves the narrowest supported path. A useful free preview is a fallback, not a completed real-payment requirement.

If the directory is sparse, recruit a small opt-in Tokyo cohort through existing personal relationships outside the app build. Do not generate fake activity. Outreach is an operator task, not authorization for an agent to send messages.

## 15. Public repository and hackathon handoff

Create a new public repository under the user's chosen GitHub owner; name proposal: new-friendship-tech. Owner is not yet supplied. User has already requested public source; do not treat the default private-repo convention as the product decision.

Publish app code under a proposed MIT license, with explicit exclusions for trademarks, private datasets, licensed fonts, and photographs. Select the final copyright holder before adding the license. The public build must run with documented development assets; never commit private contact data, newsletter exports, user records, production credentials, or infrastructure inventories.

Repository layout proposal:

~~~text
apps/web/
  app/
  components/
  lib/auth/
  lib/db/
  lib/entitlements/
  lib/payments/
  lib/ens/
  lib/privacy/
  worker/
packages/shared/
content/demo/
docs/
  SPEC.md
  BUILD-HANDOFF.md
  FRAMER-PROMPT.md
  RESEARCH-AND-DECISIONS.md
  architecture.md
  integration-evidence.md
  deployment.md
  demo-script.md
prompts/
drizzle/
README.md
LICENSE
ASSET-LICENSES.md
AI-USAGE.md
PRIOR-WORK.md
.env.example
~~~

A single package is acceptable if workspaces add friction; preserve module ownership and contracts.

Keep a sanitized fixture catalog sufficient for reviewers, using original or permitted text. Any synthetic member fixtures belong only in local demo mode with conspicuous labels and must never be loaded into the production directory. The real paid catalog is server-held content, not a public front-end seed.

Document which code, designs, and assets existed before the event. No working code existed, but earlier screenshots and brand assets do. The official Classic rules restrict prior project-specific work; obtain organizer guidance on whether those assets/designs can be used, or make fresh eligible assets during the event. Do not assume “no prior code” settles eligibility.

Include these specs, subsequent build prompts, and planning artifacts in the submission. Keep meaningful incremental commits and an AI usage log that identifies assistance and human contributions. See the research file for the official rule links.

### Demo narrative

A 3–4-minute screen recording should show:
- The Tokyo problem and the brand's real-world foundation briefly.
- Email/wallet entry and a personalized place recommendation.
- A real mainnet purchase receipt and the resulting access state; avoid making the live presentation wait for settlement.
- ENSv2 lookup, a genuine record update, and a request between two consenting accounts.
- Right now turning a selected place into a concrete meeting invitation.
- Public source and integration evidence.

Use human narration. Clearly label ENSv2 Sepolia and mainnet payment networks. Do not describe pre-recorded settlement as happening live. Keep secrets and private contacts out of the recording.

## 16. Inputs needed without blocking useful implementation

Proceed with configuration placeholders and local development where possible. These are concrete inputs, not another product questionnaire.

| Input | Needed for | Default until supplied |
|---|---|---|
| Owned domain and GitHub owner | Public routing/repo creation | DOMAIN_TBD and owner placeholder |
| Aeonik Pro webfont files/license | Final typography | Development fallback with explicit asset task |
| Tokyo branded imagery and approved logo | Final landing/app artwork | Clearly marked development assets |
| 24–36 curated Tokyo records | Useful catalog | Schema and editor first; never invented recommendations |
| Privy app configuration | Live auth | Developer setup and documented variable names |
| Merchant treasury and seller/support details | Live checkout | Purchases disabled until configured |
| GCP deployment target/access | Deployment | Follow private infra-ops; do not repurpose another app silently |
| ENSv2 parent/control and testnet resources | Namespace issuance | Link/edit spike on an authorized existing name |
| Two consenting demo participants | Social proof of functionality | Test accounts separated from production discovery |
| Organizer decision on prior designs/assets | Prize eligibility | Disclose pre-existing material; prepare fresh eligible assets |

No passwords, private keys, service-account JSON, or full newsletter export should be requested in chat. Configure secrets through the established secret-handling path.

The intended alpha is complete when a real Tokyo user can discover a worthwhile place, pay for clearly defined access, use a meaningful ENSv2 identity, and make a consent-based connection—and when the operator can verify and support those actions.
