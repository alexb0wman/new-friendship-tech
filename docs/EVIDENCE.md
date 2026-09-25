# Evidence for the submission

Everything below is captured from real Sepolia transactions and real World ID sessions. Nothing in this file may come from the local demo, which runs on a simulated chain and a simulated World. Fill it in the order of the demo script (`docs/ENS-WORLD-SPEC.md`, section 10). Until a row is filled, the corresponding claim is unproven.

## Namespace (from `ens-bootstrap.output.json`)

| Item                                         | Value                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Parent name                                  | `<parent>.eth`                                                                     |
| Operator wallet                              | `0x…`                                                                              |
| Concierge wallet                             | `0x…`                                                                              |
| App resolver (PermissionedResolver proxy)    | `0x…`                                                                              |
| Parent registry (UserRegistry proxy)         | `0x…`                                                                              |
| Tokyo city registry (UserRegistry proxy)     | `0x…`                                                                              |
| `grantSetterRoles(friendship.now)` tx        | `https://sepolia.etherscan.io/tx/0x…`                                              |
| `grantSetterRoles(friendship.table)` tx      | `https://sepolia.etherscan.io/tx/0x…`                                              |
| Concierge ENSIP-26 records tx                | `https://sepolia.etherscan.io/tx/0x…`                                              |
| `linkToNode(concierge.tokyo → concierge)` tx | `https://sepolia.etherscan.io/tx/0x…`                                              |
| Concierge cannot write `description`         | simulateContract revert reason: `…` (from bootstrap step 6 or `npm run ens:smoke`) |

## Demo steps

| Step                                                           | Evidence                                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1. Maya activates: World ID proof verified                     | Developer Portal verify response id / timestamp `…`; screenshot of the widget      |
| 1. Maya's trip name registered with expiry = departure         | `register` tx `0x…`; ENS app link for `maya.tokyo.<parent>.eth` showing the expiry |
| 1. Records written and re-read                                 | records multicall tx `0x…`                                                         |
| 2. Second account, same World ID                               | screenshot of `HUMAN_ALREADY_PRESENT`; no new trip row                             |
| 3. Kenji hosts a dinner: table record written by the concierge | `setText(friendship.table)` tx `0x…` (from = concierge wallet)                     |
| 4. Maya asks to join: World ID for Agents approval             | sandbox authorization id / `auth_time` `…`; attendee row `requested`               |
| 4. Kenji approves: his own step-up, record rewritten           | `setText(friendship.table)` tx `0x…` showing two attendees                         |
| 5. Ari declines the step-up                                    | approval row `denied`; record unchanged (same tx as above)                         |
| 5. An approval expires                                         | approval row `expired`; record unchanged                                           |
| 6. Concierge attempts `description`                            | revert reason `…` (smoke script output)                                            |
| 7. Split: shares resolved from names, Maya pays                | USDC `Transfer` tx `0x…`; attendee `paid_verified_at` set by the worker            |
| 8. Departure: the name expires                                 | ENS app or `getState` showing `AVAILABLE` after expiry; `trip.expire` tx `0x…`     |

## Screenshots to attach

1. Settings trip card with the live name, expiry and Etherscan link.
2. The World ID widget at activation and the duplicate-human error.
3. Tables list with the on-chain record link, and the table detail with the raw `friendship.table` JSON.
4. The approval modal in pending, denied and expired states.
5. The World ID sandbox consent screen for a step-up.
6. The MCP endpoint answering `tools/list` (curl output).

## Commands that produce evidence

```bash
npm run ens:bootstrap -- --register-parent
```

```bash
npm run ens:smoke
```

```bash
curl -s -X POST https://<app-origin>/api/mcp -H "content-type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
