# Verification record

Recorded 2026-09-25. These results describe local source verification, not a deployed service.

| Check                             | Observed result                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                        | Passed on Node 24.19.0 and deployment-target Node 22.23.3                                                                                                                 |
| Vitest                            | 44 tests passed on both Node 24.19.0 and Node 22.23.3, across two suites                                                                                                  |
| Database                          | Both SQL migrations execute in embedded PGlite; 20 tables                                                                                                                 |
| HTTP smoke                        | Passed with a real local Next dev server: health/database startup, homepage, app route, preview, signed session, full paid catalog, cross-origin rejection and SVG assets |
| Production compilation            | Final source build passed on Node 22.23.3, with the SDK warnings below; an earlier build also passed on Node 24.19.0                                                      |
| Content importer                  | Empty Tokyo template validates in dry-run mode; no production content imported                                                                                            |
| Production preflight              | Correctly exits nonzero for missing credentials, legal/operator settings, font assets and live checkout; no deployment attempted                                          |
| Dependency audit                  | 0 critical, 0 high, 27 moderate dependency findings after a targeted ws 8.21.3 override                                                                                   |
| Formatting                        | Prettier check passed                                                                                                                                                     |
| Desktop/mobile browser tests      | Supplied, **not executed here**. Browser access to this local server was blocked by the environment.                                                                      |
| Real Privy / KMS / ENS / 0G       | **Not exercised**. No credentials, namespace provisioning, merchant adapter or real payment was used.                                                                     |
| GCP / Framer / GitHub publication | **Not performed**. Config and source are prepared for handoff.                                                                                                            |

## What the automated tests prove

The API suite invokes the same Web Request handler used by Next against the actual migrated PostgreSQL-compatible embedded database, with signed local demo sessions. It checks server-enforced preview versus paid access, bad cookies/origins/payloads, immutable role permissions, profile privacy, connection consent, third-party access denial, contact withdrawal, idempotent and reciprocal requests, quotas, block/unblock, invitation expiry, visibility withdrawal, retained saves, global-city access, invoice ownership, duplicate settlement, renewal, untrusted callback hints, late-payment review, moderation and disabled ENS behavior.

Domain checks validate settlement chain/recipient/asset/payer/quote/amount/finality/receipt/event identity, thirty-day arithmetic, encrypted-contact owner binding, production demo rejection, fail-closed live payments, ENS normalization, exact ENS transaction matching and local hostname normalization.

PGlite is one embedded engine. These tests do **not** establish multi-connection PostgreSQL 16 lock scheduling, production throughput or provider behavior. Run the listed production database and external-integration checks before launch.

## Issues caught and fixed during this build

- A high-severity transitive `ws` issue was removed with a narrowly scoped override of version 8 to 8.21.3. Version 7 dependencies were left on their own supported range.
- The real HTTP check exposed a development hostname mismatch: Next's internal Request URL could use localhost while the browser used 127.0.0.1. Demo mutation origin checks now validate the loopback Host; production still uses configured APP_ORIGIN. A regression test covers the difference.
- Test generation initially used a JSON formatter on a BigInt fixture. The test label was corrected; the actual contract checks use BigInt base units.
- The tsx CLI attempted a Unix IPC socket unavailable in this runtime. Operational scripts now use Node's `--import tsx` loader, and the content-import dry run succeeds without that CLI socket.
- ENS confirmation was strengthened to bind an expiring server intent to exact sender, resolver, calldata, chain, zero value and the fresh record value. It no longer treats any successful transaction from the wallet as proof of the requested change.

## Remaining warnings and audit findings

The build reports an optional Farcaster/Solana module missing inside the Privy package and a dynamic-dependency warning in viem/ox's Tempo chain exports. The app config uses EVM email/wallet auth and does not invoke the Farcaster/Solana integration. These warnings do not fail compilation, but actual configured Privy and ENS wallet flows still require browser testing.

Vitest reports that its CommonJS-loaded TypeScript config uses ESM syntax that a future native Vite config loader may not accept. Tests currently pass; adapt the config format during a future toolchain upgrade.

The complete audit snapshot is `dependency-audit.json`. The remaining moderate advisories involve `decode-uri-component`, a transitive development `esbuild`, and `uuid`, with findings propagated through dependent packages. Do not force npm's proposed package downgrades without reviewing the affected SDK compatibility and security implications. This repository is not represented as vulnerability-free.

## Reproduce

```sh
npm ci
npm run typecheck
npm test
npm run smoke
npm run build
npm run format:check
npm audit --audit-level=high
```

Use the browser commands in README.md in an environment that can open the local server. Use LAUNCH-CHECKLIST.md for the remaining production gates.
