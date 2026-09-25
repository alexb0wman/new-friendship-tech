<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project-specific implementation rules

- Start with README.md and docs/INTEGRATIONS.md. Do not replace the existing service layer with client-only state.
- Keep All Access global. Never attach a city to an entitlement.
- Keep the 0G merchant adapter closed until source/order/destination settlement is independently verified. Browser callbacks are hints.
- Do not use a name or wallet as the immutable account ID. Resolve and verify ownership at the relevant trust boundary.
- Do not expose contacts through profiles, logs, ENS records or unauthenticated APIs.
- Keep demo mode local. Production processes must reject it, and production content imports must not seed sample data.
- Update source, API/domain tests and migration files together when changing money, identity or social authorization behavior.
- Use the current Next documentation shipped with this version for framework conventions. Do not delete the generated rules above.
- Preserve the source/brand/font licensing split. No private infrastructure guide, credential or newsletter export belongs in the public repository.
