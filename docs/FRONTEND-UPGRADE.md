# Frontend upgrade

Built on `6f818e3`. A presentation-layer upgrade: new homepage, a motion system, a refined app shell,
and component polish across every screen. No API, service, schema, auth, payment
or identity code was touched.

## What changed

| Area              | Files                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Homepage          | `src/app/page.tsx`, `src/components/home/home-page.tsx`, `src/app/styles/home.css`                           |
| Motion primitives | `src/components/motion.tsx` (`Reveal`, `SplitWords`, `PreviewList`, `useInView`)                             |
| Motion system     | `src/app/styles/motion.css` (easing tokens, keyframes, reveal states, dialog/toast/drawer/route transitions) |
| App shell         | `src/components/app-shell.tsx`, `src/app/styles/shell.css`                                                   |
| Components        | `src/app/styles/components.css` (buttons, chips, fields, cards, skeletons, empty and paywall states)         |
| Font fallback     | `src/app/fonts/Figtree-Variable.woff2` + `Figtree-OFL.txt`, wired in `src/app/layout.tsx`                    |
| Cleanup           | `src/app/globals.css`: ~960 lines of styles from three retired homepages removed; animated grain made static |

The new stylesheets load after `globals.css` (see `layout.tsx`) and refine the base
rules in place. Markup in the views is unchanged.

## Homepage

Sections: hero, scroll-opening photo frame with marquee, real-world foundation
(60K+ cumulative attendees and ~60K newsletter subscribers, kept separate and
labelled as the spec requires), a hover index of what members do, how it works,
Right now (with a clearly labelled example), membership, FAQ and a closing call to
action. The e2e check for `60K+` on `/` now passes against this page.

Copy follows the current homepage and `docs/reference/FRAMER-PROMPT.md`. Nothing
new is claimed. The FAQ answers are the brief's, trimmed of Tokyo-first phrasing.

## Motion rules

- One orchestrated moment per screen: the homepage headline assembles on load
  (words rise, photo pills open); app screens wipe their page title in.
- Everything else moves only in answer to the visitor: scroll, hover, open, save.
- Scroll-linked effects (photo frame opening, wordmark settling, homepage progress
  bar) use CSS scroll-driven animations and are skipped where unsupported.
- Dialogs animate in and out with `@starting-style`; on phones they become bottom sheets.
- FAQ answers animate height with `::details-content` where supported; elsewhere
  they open instantly.
- `prefers-reduced-motion: reduce` disables all of it, and nothing starts hidden
  unless JavaScript is running and motion is allowed.

To tune timing, edit the tokens at the top of `motion.css`.

Implementation note: Chromium's IntersectionObserver treats a fully `clip-path`-ed
target as not intersecting, so `<Reveal variant="mask">` clips its children, never
the observed element. Keep that pattern if you add new reveal variants.

## App shell

- Route transitions: the page content is keyed on the pathname and fades in.
- Mega menu: anchored to the header's measured bottom edge, staggered entry, closes on
  Escape and on navigation. The header stays above the backdrop so the open tab stays
  visible.
- A small lime dot marks the nav section that owns the current page (desktop and mobile).
- `<AppShell bleed>` removes main padding for full-width pages (used by the homepage).

## Fonts

Visby remains first in the stack. Its files are still not in the repo
(`public/fonts/*.woff*` is gitignored), so until they are supplied the app now falls
back to Figtree, an SIL OFL geometric sans chosen as the closest open match, instead
of Arial. Remove `fallbackSans` from `layout.tsx` if you prefer a system fallback.

While testing, the dev log showed `/fonts/Visby-*.woff2` returning 200 even though
the files are absent, which suggests the catch-all route answers those requests with
a page. Worth checking when the licensed files go in.

## Verification done

- `npm run typecheck`: clean.
- `npm test`: 196/196 passing (14 files) on `6f818e3`.
- `npm run build` with CI's environment variables: succeeds; `/` prerenders as static.
- Visual review in the local demo at 1440, 820 and 390 px: homepage, `/tokyo`,
  `/membership`, mega menu, city dialog (desktop and bottom sheet).

Not done here: `npm run test:e2e` (Playwright's bundled browsers could not be
downloaded in the authoring sandbox), Safari and Firefox checks, and real devices.

## Known pre-existing issues (not changed)

- `npm ci` fails on a clean checkout: `package-lock.json` is out of sync with the
  `ws` override and a nested `zod`. Run `npm install` once and commit the lockfile,
  or CI stops at its first step.
- `npm run format:check` already failed on 14 files before this change. Files
  touched here are Prettier-formatted.
