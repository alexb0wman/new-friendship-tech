# New Friendship Tech — Framer homepage prompt

Paste this brief into the Framer build agent with the founder's image/font assets. Replace APP_ORIGIN and approved links before publication.

## Objective

Create a complete responsive marketing website for **New Friendship Tech**, presented by Urconduit.

It is a connection membership for people who travel, especially founders, builders, investors, operators, creators, and people around Web3, crypto, AI, and technology. Anyone can join.

The product helps people discover places, meet relevant people, and make actual plans. Launch content is Tokyo. **One All Access membership covers every published city and all released member features.** There are no city passes or paid feature tiers.

The app lives on a GCP-backed subdomain. This Framer site explains and sells the idea, then sends visitors to the app for sign-in and payment.

## Visual direction

Primary reference: https://tbdstudio.framer.ai/

Study the live reference at desktop and mobile widths before building. Use its near-black palette, editorial type scale, framed photography, thin hairlines, lime accents, compact utility labels, confident spacing, and restrained movement.

Use **Aeonik Pro for every authored text element**, including navigation, labels, numbers, buttons, FAQs, and footer. Do not retain the reference's Geist/monospace typography. Use supplied licensed webfont files. If absent, create an explicit development fallback and asset task; do not falsely claim Aeonik is installed.

Colors:
- Page: #050505.
- Cards: #101010, with #181818 for raised panels.
- Text: #E8E8E8.
- Secondary text: #A3A3A3.
- Accent: #C7FF97, with dark text on filled lime controls.
- Dividers: subtle white at approximately 14% opacity.

Desktop content width up to 1440px; 32px gutters. Tablet 24px, mobile 16px. Hero frame radius 32px desktop, 20px mobile. Cards 16px. Buttons at least 44px tall, normally 48px. Body text 16px minimum for primary reading.

Use one supplied Tokyo hero image with intentional focal-point crops. Apply a restrained grayscale/dark treatment where appropriate, without destroying the branded artwork. Add a thin inset border/frame. Do not use stock crypto coins, glassy dashboard gradients, glowing token logos, or generic AI illustrations.

Keep the site image-led and typographic. Lime is emphasis, not the background for every section. Avoid decorative motion that delays the main CTA.

## Page structure and exact starting copy

### 1. Header

Left: New Friendship Tech wordmark.

Desktop links: Tokyo · How it works · Membership.

Right: Log in, and “Get connected.”

Mobile: wordmark, a compact CTA if it fits, and a working menu button. The menu opens a focus-managed sheet with the same links. Anchor navigation closes the menu and lands below the sticky header.

Log in links to APP_ORIGIN.
Get connected links to APP_ORIGIN/onboarding.

### 2. Hero

Eyebrow: TOKYO ALPHA · A NETWORK THAT TRAVELS WITH YOU

Headline:
**Your people.**
**Your places.**
**Your next move.**

Highlight one phrase or word in lime; do not animate the headline into illegibility.

Body:
“Discover places worth knowing, meet people worth knowing, and turn a new city into familiar ground.”

Primary CTA: “Explore Tokyo” → APP_ORIGIN/tokyo
Secondary CTA: “See membership” → #membership

Small supporting line:
“Starting in Tokyo. One membership for every city we publish.”

Hero image uses the founder's supplied Tokyo artwork. Add a restrained utility label such as “35.6762° N / 139.6503° E” only if it is clearly city-level decoration, never a member's location. The coordinate line is optional and must not displace useful copy.

A small floating card can preview a real curated place or a clearly labeled product preview. Do not show a fake live member count or a fictional testimonial.

### 3. Real-world foundation

Heading: “Built from real-world connections.”

Two distinct metrics:
- “60K+” — “Cumulative attendees across our events”
- “~60K” — “Newsletter subscribers”

Supporting copy:
“New Friendship Tech brings together emerging technology, culture, and community—through curated events and the connections that continue afterwards.”

These figures are founder-supplied. Keep the labels intact. Do not write “60K app members,” “60K unique attendees,” or combine the two figures.

Optional historical brand row only after the founder selects cleared logos. Label it “Selected past collaborations.” Do not imply those brands are investors in, customers of, or endorsers of the app.

### 4. Tokyo, made personal

Heading: “Less searching. More being there.”

Intro:
“A place to work. A table to share. Somewhere the night can go. Start with recommendations chosen for how you want to spend your time.”

Three cards:
- **Places with a point of view.** “Curated recommendations, matched to your interests.”
- **People open to connecting.** “Find members with shared interests and make an introduction.”
- **A plan for right now.** “Coffee, food, a walk, or a work session—when the timing is right.”

Use actual app screenshots when available. Until then, use clearly labeled “Product preview” compositions with generic interface text. Do not invent named people, venues, transaction success, or available events.

CTA: “Find your Tokyo” → APP_ORIGIN/tokyo

### 5. A network that travels with you

Heading: “New city. Familiar connections.”

Copy:
“Your people, preferences, and saved places stay with you. Your membership includes every published city, with more destinations added as the collection grows.”

Show Tokyo as “Live first.” Other city names should appear only when the founder approves the roadmap, with an honest “Planned” label. Do not publish empty destination pages. Do not show dates or city counts that have not been committed.

Optional small feature labels:
“Your saved places” · “Your connections” · “New cities included”

The existing 3,000 Asia pins may be referenced as an editorial resource being prepared only with clear wording. Prefer omitting the number until it describes usable app content.

### 6. How it works

Three numbered steps:
1. **Tell us what you're into.** “Choose your interests and what you'd like to do.”
2. **Find your place—and your people.** “Explore a shortlist and connect with members who opt in.”
3. **Make it real.** “Choose a place, agree a time, and take the connection offline.”

Keep the structure simple. On mobile, stack steps; do not build a horizontal scroll trap.

### 7. Right now feature

Heading: “Good connections need good timing.”

Copy:
“Open to coffee? Looking for a work buddy? Put a simple plan out there and see who's interested.”

Visual: an example invitation explicitly labeled “Example.”
Example:
“Coffee · Shibuya”
“Open for the next two hours”
“Request to join”

Do not imply that this example is a live invitation. Use the actual feature screenshot when it is ready.

Supporting line:
“You choose what to share. Contact details are revealed only after you both accept.”

CTA: “See what's happening” → APP_ORIGIN/tokyo/now

### 8. Membership

Anchor: #membership

Heading: “One membership. Every published city.”

One pricing card only:

**All Access**
**$19 / 30 days**

Benefits:
- Full access to our published city collections
- Recommendations tailored to your interests
- Member discovery and connection requests
- Right now invitations
- Saved places and connections that travel with you
- New cities included as they launch

Under benefits:
“Up to 10 new connection requests per access period. Separately ticketed events, meals, and drinks are not included.”

Primary CTA: “Get All Access” → APP_ORIGIN/membership
Secondary text link: “Preview Tokyo first” → APP_ORIGIN/tokyo

Payment note:
“Crypto payment. 30 days of access. Renew manually.”

Availability note:
“Tokyo is the first fully usable city in the alpha.”

Do not put $9, separate Explore/Connect tiers, Circle membership, a city selector that changes price, automatic-renewal claims, or a fake annual discount into the design.

If checkout is not live, use “Preview the alpha” as the action and clearly state that paid membership is not yet available. Do not leave a broken Buy button.

### 9. The community behind it

Heading: “Technology, creating new friendships.”

Copy:
“From founder gatherings and creative dinners to workshops, showcases, and late-night conversations, New Friendship Tech brings people together around what comes next.”

Use approved event imagery from the founder. A Seoul/KBW case study can appear here as historical or separately scheduled brand context, with its true date and status. It must not be presented as a Tokyo event available through this alpha.

Credit: “New Friendship Tech is presented by Urconduit.”

No long roll call of celebrities or brand names. Prioritize a small number of credible, cleared examples.

### 10. FAQ

**What is live today?**  
“The alpha starts with Tokyo: curated places, member connections, and simple plans for right now. More cities are included as they launch.”

**Is this just for people in crypto?**  
“No. Anyone can join. It is especially useful for people who travel around technology, business, and creative communities.”

**Does one membership cover every city?**  
“Yes. All Access covers every published city and all released member features. You do not buy access again when you travel.”

**Do I need a wallet to sign up?**  
“You can start with email. Paying for membership requires a supported funded wallet; the app guides you through the available options.”

**Does membership renew automatically?**  
“No. In the alpha, you buy 30 days of access and renew manually.”

**Are events and meals included?**  
“Membership helps you discover and connect. Separately ticketed events, venue charges, meals, and drinks are paid separately.”

**Who can see my profile and contact details?**  
“You choose whether your profile appears in member discovery. Contact sharing requires mutual acceptance.”

**What is the ENS passport?**  
“An optional way to use a wallet-linked name to find your profile and connect. The alpha's ENSv2 feature runs on a test network; membership payments use mainnet.”

Use accessible accordion behavior. Do not auto-open every answer on mobile.

### 11. Final CTA and footer

Headline: “Make somewhere new feel like somewhere you belong.”

CTA: “Explore Tokyo” → APP_ORIGIN/tokyo

Footer:
New Friendship Tech  
Presented by Urconduit  
Support · Privacy · Terms · Approved social links

No dead links. Final policy/support URLs and domain are configuration inputs.

## Responsive and interaction requirements

Breakpoints: mobile below 810px, tablet 810–1199px, desktop 1200px and up.

At 360px:
- The headline fits without sideways scrolling.
- Hero buttons stack with full tap targets.
- The hero image retains its focal point.
- Both audience metrics retain distinct labels.
- Pricing is one readable card.
- FAQs, menu, and footer work with touch and keyboard.
- No sticky element covers content or the browser safe area.

At 810px:
- Two-column content where genuinely readable.
- Typography/gutters interpolate without a sudden oversized hero.
- No floating proof card overlaps the headline.

At 1440px:
- Use generous editorial spacing and strong composition.
- Keep body text to readable widths.
- Do not stretch cards into sparse empty rectangles.

Use descriptive alt text, correct heading hierarchy, clear focus, adequate contrast, optimized images, fixed media aspect ratios, and reduced-motion behavior. Lazy-load below-fold imagery; prioritize the hero image and font loading.

## Technical boundaries and deliverables

Use native Framer components, reusable variants, and CMS only where it reduces maintenance. Do not add authentication, wallet SDKs, checkout logic, private member data, or a separate account database to Framer.

Track only simple, consent-appropriate marketing events such as CTA clicks; do not send private profile data or wallet addresses to analytics. Cross-domain links contain no auth tokens.

Deliver:
1. Responsive Framer page with all real links.
2. Shared colors, typography, spacing, and component styles.
3. Asset manifest with font/image status and rights notes.
4. Desktop and mobile screenshots from the actual build.
5. List of missing inputs and any claims withheld until verified.
6. Page title, description, favicon, and social card using approved assets.

Suggested metadata:
Title: “New Friendship Tech — Your people. Your places.”
Description: “Discover curated places, meet relevant people, and make real plans. One membership for every published city. Starting in Tokyo.”
