# Concierge

One agent for the whole product, published as `concierge.<parent>.eth` with ENSIP-26 records (`agent-context`, `agent-endpoint[mcp]`, `agent-endpoint[web]`) and aliased under every city (`concierge.tokyo.<parent>.eth` links to the same record bundle).

## What it can do

Read: who is around (trip names with a `friendship.now` record), which tables are open, whether a trip name belongs to a verified human present in the city. These are the three tools exposed on `/api/mcp` to any other agent, read-only, names only.

Write, with its own wallet: the `friendship.now` text record on a trip name and the `friendship.table` record on a table name. The app resolver grants it those two setter roles and nothing else; a write to any other key reverts on chain.

Act: never on its own. Every proposal becomes an `agent_approvals` row that the member answers with a fresh World ID authentication. The executor runs only after the backend validated the identity, inside the transaction that marks the approval consumed.

## Files

| File              | Responsibility                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `tools.ts`        | Read-only tools shared by the agent loop and the MCP server                                        |
| `brain.ts`        | `ConciergeBrain` interface and the shipped `RuleBrain`                                             |
| `custom-brain.ts` | Owner extension point (`CONCIERGE_BRAIN=custom`)                                                   |
| `agent.ts`        | `turn()`: context, brain, proposals to approvals; the `now.publish` and `contact.reveal` executors |
| `mcp.ts`          | JSON-RPC 2.0 handler for `src/app/api/mcp/route.ts`                                                |

## Plugging in a model

Implement `ConciergeBrain` in `custom-brain.ts` and export `createBrain()`; set `CONCIERGE_BRAIN=custom`. The input is the member (id, name, neighbourhood), the city, the message and a read-only context (open tables, who is around, the member's trip, pending introductions). The output is a reply and a list of proposals `{ action, payload, summary }`. Keep three rules: never execute anything yourself, never include a wallet or a contact in a reply, and only propose the four actions the executors know (`now.publish`, `table.request`, `table.approve`, `contact.reveal`). The plumbing does the rest.

The `RuleBrain` stays as the fallback and as the deterministic path for the demo and the tests.
