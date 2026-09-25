# Contributing

Use Node 22 and the npm lockfile. Read AGENTS.md, README.md and docs/ARCHITECTURE.md. Run type checks and the targeted API/domain tests for behavior changes. Generate a new Drizzle migration for schema changes; never rewrite an applied migration.

Keep mutations and authorization in server services, not UI controls. Record meaningful provider integration evidence separately from local simulation. Add tests for money, identity, privacy and state transitions when changing their behavior. Do not add repetitive tests solely to increase the count.

Format with npm run format. Preserve user-supplied brand and content restrictions. Keep commits focused and explain what works, how it was verified and what remains incomplete.
