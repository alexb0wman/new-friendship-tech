# New Friendship Tech — research and decision register

Checked 25 September 2026. Sources are first-party where available. Pricing, SDK versions, beta contracts, and event rules may change; recheck the exact version/configuration used during implementation.

The final commercial direction incorporates the user's latest correction: **one global All Access membership**, with Tokyo-first content. Earlier tier proposals are superseded.

## 1. Findings that change the build

| Finding | Evidence | Consequence |
|---|---|---|
| ENSv2 prize uses Sepolia | Official ENS partner page and ENSv2 docs | Keep ENSv2 testnet separate from mainnet payments; make it functionally central |
| ENS new-build prize pool is $6,000 | Official partner page | Target the relevant new-build track; do not confuse it with the continuity pool |
| 0G is not listed among the Tokyo prize partners checked | Official prize directory | Use 0G Pay for the product; do not invent a sponsor bounty |
| Submission deadline is 27 September, 09:00 JST | Official event details | Freeze features early enough for demo and submission |
| 0G SDK supports custom recipient mode | Official documentation and published package | Merchant collection is plausible, but must be proved end to end |
| REST deposit docs omit custom-recipient input | Live API documentation | Do not assume SDK merchant mode and REST credit top-up are interchangeable |
| SDK callback surface needs care | Published 0.2.1 TypeScript declarations | Test actual exact-input/output behavior before building the payment UI |
| Privy has a material MAU price step | Official pricing page | Budget for free-account growth as well as paying members |
| Reference has specific responsive breakpoints | Published Framer CSS | Implement mobile <810, tablet 810–1199, desktop ≥1200; visually check phone layouts during build |
| Node 20 is EOL | Official Node release page | Use Node 22 LTS as the explicit operating-model deviation |
| Earlier designs/assets may affect eligibility | Official Classic rules | Disclose them and obtain organizer guidance; no-code-yet does not resolve this |

## 2. Pricing comparisons

| Product | Observed price | What is comparable | Limit |
|---|---:|---|---|
| Neighborhood Guide Tokyo | US$22 once | Curated city discovery | 250+ locations and permanent access, not a subscription network |
| Timeleft | US$19.99/month in its US example | Paid access to real-world social activity | Different service: it organizes bookings; food/drink separate; regional prices vary |
| TripIt Pro | US$49/year | Ongoing utility for travelers | Travel management, not people discovery |
| NFTech recommendation | US$19 per 30 days | Curation + network + all published cities | Hypothesis to validate with the first cohort |

Sources:
- [Neighborhood Guide Tokyo](https://www.neighborhood.guide/shop/p/tokyo-city-guide)
- [Timeleft booking guide](https://timeleft.com/blog/how-to-book-timeleft-first-dinner/)
- [Timeleft subscription options](https://help.timeleft.com/hc/en-150/articles/27963865308060-What-Subscription-Plans-Are-Available)
- [TripIt Pro](https://www.tripit.com/web/pro)

Inference: NFTech needs ongoing social and editorial value to sustain renewals. The subscription should not be justified solely by access to a static list. The $19 recommendation reflects a low-friction initial test, not evidence that customers will pay it.

All Access should travel with the member. Future annual pricing around $149 is a proposed experiment, not an alpha commitment. No price comparison here implies equal service quality or coverage.

## 3. Auth choice

Choose Privy for the initial build, subject to the auth/payment spike. Its EVM configuration supports custom chains and its prebuilt experience fits the short deadline. ENS functionality depends on a verified wallet and ENS-capable client, rather than a vendor-specific ENS login feature.

Observed pricing: free band 0–499 MAU, Core $299/month at 500–2,499, Scale $499/month at 2,500–9,999, with usage conditions. Treat the account's current terms as authoritative.

Turnkey remains a credible alternative if a demonstrated integration issue blocks Privy. Do not spend scarce time integrating both wallet backends.

Sources:
- [Privy EVM network configuration](https://docs.privy.io/basics/react/advanced/configuring-evm-networks)
- [Privy pricing](https://www.privy.io/pricing)
- [Turnkey authentication overview](https://www.turnkey.com/blog/embedded-wallet-authentication)
- [0G Pay's use of wallet/social onboarding](https://0g.ai/blog/0g-pay-credit-cards)

## 4. ENSv2 implementation evidence

ENSv2 is available as a Sepolia beta at the checked date. The official partner requirements call for a working, central integration, a live demo, and accessible source. The new-build pool is $6,000; the separate $4,000 pool is for continuity integrations.

The recommended product feature uses the v2 hierarchy and permissioned records to provide a member-controlled passport, then uses resolution in actual member lookup and connection requests. It does not turn experimental naming contracts into a mainnet payment dependency.

Authoritative references:
- [ENS Tokyo partner requirements](https://ethglobal.com/events/tokyo2026/prizes/ens)
- [ENSv2 overview](https://docs.ens.domains/ensv2/overview/)
- [ENSv2 beta announcement](https://ens.domains/blog/post/ensv2-beta-public-testing)
- [Application developer guide](https://docs.ens.domains/ensv2/tutorial-app-developers/)
- [Contract developer guide](https://docs.ens.domains/ensv2/tutorial-contract-developers/)
- [Permissioned registry](https://docs.ens.domains/ensv2/permissioned-registry)
- [Permissioned resolver](https://docs.ens.domains/ensv2/permissioned-resolver/)
- [ENSv2 readiness](https://docs.ens.domains/web/ensv2-readiness/)
- [Canonical deployments](https://docs.ens.domains/learn/deployments/)

Implementation must record the exact library, ABI, and deployment versions used. The research did not deploy a namespace or verify ownership of a proposed parent name.

## 5. 0G Pay evidence and limits

Inspected:
- Live documentation at [pay.0g.ai/docs](https://pay.0g.ai/docs).
- The published [0G Pay SDK package](https://www.npmjs.com/package/@0gfoundation/0g-pay-sdk).
- Official npm registry metadata and the stable 0.2.1 package README/type declarations.
- Public health endpoint response.

The stable package metadata pointed to the official [0gfoundation/0g-pay-sdk repository](https://github.com/0gfoundation/0g-pay-sdk); the repository page itself was not successfully fetched in this session.

Observed SDK facts: EIP-1193 provider input, developer mode with recipientAddress, crypto/card method selection, amount prefilling, and callbacks. The inspected exported props do not mirror every internal exact-output callback. This is a compatibility issue to test, not proof the entire SDK is unusable.

The API describes a per-wallet funding system. The documented prepare fields are fromChainId, fromToken, amount, and fromAddress; confirm takes quote/route/transaction identifiers. The order endpoint can long-poll for up to five minutes. It is not a documented recurring-subscription API.

What remains unproved:
- The exact merchant settlement asset and supported route selected for this app.
- Binding that route's provider evidence to an authenticated invoice.
- Server-side finality and settlement verification.
- Fee/slippage behavior on the selected real route.
- End-to-end success with Privy and the pinned SDK.
- An actual real payment, refund, or entitlement activation.

These are implementation gates. No transaction was sent during research.

Network source:
- [0G Mainnet details](https://docs.0g.ai/developer-hub/mainnet/mainnet-overview): chain 16661, official RPC and explorer configuration.

Context:
- [0G Pay announcement](https://0g.ai/blog/0g-pay-credit-cards)
- [Khalani's integration explanation](https://blog.khalani.network/khalani-powers-0g-pay)

Do not use marketing descriptions as a substitute for transaction-level proof.

## 6. Design and brand research

[TBD Studio](https://tbdstudio.framer.ai/) was inspected in a live desktop browser and through its published responsive CSS. Observed characteristics: dark surfaces, grayscale editorial imagery, large type, thin frames, lime accent, small navigation labels, rounded image frames, and spacious sectional rhythm. Published breakpoints separate below-810 mobile, 810–1199 tablet, and 1200+ desktop layouts.

A live mobile viewport capture was not obtained. The delivered responsive matrix is an implementation specification; the build agent must inspect and capture the actual mobile result.

[Urconduit](https://urconduit.webflow.io/) supports the event-led, arts/culture/technology community positioning. The public page still contains older cumulative attendance figures and placeholder content. The user's latest supplied figures supersede that old marketing copy in the brief: 60K+ cumulative event attendance and approximately 60K newsletter subscribers, separately labeled. Those updated figures have not been independently audited.

[Neighborhood Guide](https://www.neighborhood.guide/) demonstrates clear city packaging and practical Maps-linked discovery. NFTech's proposed distinction is personalization plus an active connection workflow, not an unsupported claim to more locations at alpha launch.

The supplied screenshots were available locally and reviewed. Their strongest alpha concepts are member discovery, curated events, saves, and expiring Right now intentions. Relationship graphs, standings, editorial intelligence, and broad company directories lack the data and operational foundations for this build.

The supplied GCP operating document was also reviewed. It is private operational context and must not be copied into the public repo.

## 7. Event and repository requirements

Use the [official Tokyo details](https://ethglobal.com/events/tokyo2026/info/details) and [prize directory](https://ethglobal.com/events/tokyo2026/prizes) as current authorities.

Key implications: submit by 09:00 JST on 27 September; preserve development history; disclose reused work and AI assistance; include planning/spec/prompt artifacts. Prior project-specific designs/assets need organizer clarification under Classic rules. The recommended optional demo is 2–4 minutes with human narration; see the official page for upload constraints.

No message has been sent to organizers, providers, or other people as part of this research.

## 8. Explicit decision register

| Decision | Why | Revisit when |
|---|---|---|
| One $19 All Access product | User requested all-or-nothing, all-city membership | Cohort usage and willingness to pay are known |
| Global entitlement | City changes should not trigger a second purchase | No anticipated need to change |
| Tokyo content first | Existing launch focus and deadline | Another city has reviewed content and an editorial owner |
| Rules-based tailoring | Fast, explainable, no hallucinated venue claims | Data and usage justify an AI layer |
| No interactive map dependency | Curated value can ship with Google Maps deep links | Licensed coordinates/import pipeline is ready |
| External event registration | Avoid ticketing and venue-operation scope | The platform owns real ticket inventory |
| Mutual contact handoff | Delivers connection without building chat | Retention evidence supports in-app messaging |
| Manual renewal | No verified recurring-payment primitive | Provider supports a proven mandate/lifecycle |
| Privy default | Fits login and provider needs | Spike exposes a concrete blocker |
| ENSv2 isolated on Sepolia | Matches current availability and prize | Official mainnet deployment and migration plan exist |
| GCE/PM2 now | Matches the supplied operating path | Explicit Cloud Run graduation is approved |
| Node 22 LTS | Supported runtime, unlike Node 20 at checked date | Dependency support or security requires change |

Runtime source: [Node.js release status](https://nodejs.org/en/about/previous-releases).

## 9. After the hackathon

First: observe whether people actually save places, accept requests, return, and renew. Improve the weakest part of that loop before adding large surfaces.

Second: publish one additional city from the existing Asia curation. Export/source the founder-owned list data, deduplicate, match places carefully, preserve original notes and provenance, review rights, verify a useful subset, and assign a curator. Do not promise that Google saved-list links automatically become a clean licensed database.

Third: test a weekly editorial cadence and opt-in travel overlap. Reminders and newsletter sends require explicit product consent and an implemented delivery system; they are not automatically authorized by this specification.

Later candidates: shared collections, more powerful search, read-only concierge grounded in approved place records, curated hosted programming, and interactive maps. A social graph, reputation score, automated booking, and autonomous spending remain separate projects.
