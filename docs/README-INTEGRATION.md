# ENSv2 + World ID drop for New Friendship Tech

Built 2026-09-26 for ETHGlobal Tokyo 2026, on top of `main` at `8c83694`. Target prizes: ENS "Best Use of ENSv2", World "Best Use of IDKit", World "Best Use of World ID for Agents".

## What you get

Your Tokyo trip is a name. Activating it opens World ID; when the proof checks out, `maya.tokyo.<parent>.eth` is minted as a non-transferable subname that expires on your departure date. Tables (coffee, breakfast, lunch, dinner, drinks) are data-only names under `tables.tokyo.<parent>.eth` whose attendee record lists people by name and is written by a concierge wallet that can write exactly two records and nothing else. Asking for a seat, approving a guest, posting where you are and revealing your contact each wait for a fresh World ID authentication. After dinner the host splits the bill; shares resolve to addresses from names and count only once the worker sees the transfer on chain. The concierge is a named agent (`concierge.<parent>.eth`, ENSIP-26 records, read-only MCP endpoint) that proposes and never acts alone.

The local demo (`npm run demo`) runs all of it on simulated chain and World adapters, including every failure path judges ask for. Production runs on the Sepolia ENSv2 beta and the World sandbox.

## Files in this folder

- `AGENT-MERGE-GUIDE.md`: hand this to your build agent. It has the merge routes, every touched file, verification commands and the repository gotchas.
- `ens-world.bundle`: the git branch (`git fetch ens-world.bundle ens-world:ens-world`).
- `patches/`: the same 17 commits as a `git am` series.
- Everything else is laid out at its repository path: new files as files, modified files as `<path>.patch`.
- `MANIFEST.txt`: the exact list, A for added, M for modified.

## Five-minute merge

From the fork link:

```bash
git remote add drop https://github.com/don-radman/new-friendship-tech.git
git fetch drop ens-world
git merge --no-ff drop/ens-world
```

From the zip:

```bash
git fetch /path/to/ens-world-drop/ens-world.bundle ens-world:ens-world
git merge --no-ff ens-world
npm ci && npm run typecheck && npm test && npm run build
npm run demo
```

## Before judging (owner only)

Register the parent name, fund two Sepolia wallets, run `npm run ens:bootstrap`, create the World app and the sandbox OIDC client, deploy behind HTTPS, run `npm run ens:smoke`, fill `docs/EVIDENCE.md` and the two debriefs. Section 9 of the merge guide lists it step by step.

## Where the thinking lives

`docs/ENS-WORLD-SPEC.md` is the spec as written. `docs/ENS-WORLD-DESIGN.md` records every decision and every place the build deviates from the spec, with the reason (record aliasing moved to the concierge name, no resolver on the city entry so expired trips stop resolving, OIDC step-up details, MockUSDC for the split, why 0G Pay is a note and not a mount). Read the design doc first if something looks different from the spec.
