# Live integration verification

Branch: `feat/live-integrations-launch`  
Base: `2bde845`  
Reviewed: September 26, 2026

| Check                         | Result                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm test`                    | 196 tests passed across 14 files                                                                                     |
| `npm run typecheck`           | Passed                                                                                                               |
| `npm run build`               | Passed; production routes generated                                                                                  |
| `npm run smoke`               | Passed: boot, migrations, homepage, app route, preview, signed session, full catalog, origin enforcement and artwork |
| Journal-driven migration test | All six migrations apply; rerun preserves stored data                                                                |
| `git diff --check`            | Passed                                                                                                               |
| `npm run integrations:check`  | Correctly reports blocked because this checkout has no live credentials or provider configuration                    |

The build emits upstream warnings for viem's dynamic Tempo import and Privy's optional Farcaster Solana module. Neither prevents this build. The 0G checkout does not import the SDK browser wrapper or `ethers`.

Tests cover production adapter input/output validation using controlled RPC/provider responses, plus real application handlers and SQL transactions in PGlite. These are not real blockchain transactions or genuine World proofs. Payment rejection, late-return recovery, durable provider order recovery, ENS signed-transaction recovery, expired-trip behavior, one-use World challenges, approval races, split replay protection, and production mode boundaries are included.

No Sepolia or mainnet funds were sent. No World production app credentials were used. No live quote, provider route, 0G call trace, mobile wallet return, genuine World App session, refund or deployment has been attested. Source-price and destination-amount checks are implemented, but provider acceptance of the supported bounded-approval route remains a live acceptance requirement.

Use [LIVE-LAUNCH-SPEC.md](LIVE-LAUNCH-SPEC.md) for activation and [EVIDENCE.md](EVIDENCE.md) for actual external evidence. Do not describe the implementation as deployed or all-mainnet: ENSv2 remains Sepolia-only.
