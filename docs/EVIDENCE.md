# Evidence for the submission

No live transaction or production World session has been captured in this file yet. The rows below are placeholders, not evidence. Complete the live acceptance path in `docs/LIVE-LAUNCH-SPEC.md`; only actual chain receipts and real World production verification may fill these rows. ENSv2 receipts remain Sepolia testnet evidence. Never insert simulated hashes.

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

| Step                                                           | Evidence                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1. Maya activates: World ID proof verified                     | Developer Portal verify response id / timestamp `…`; screenshot of the widget       |
| 1. Maya's trip name registered with expiry = departure         | `register` tx `0x…`; ENS app link for `maya.tokyo.<parent>.eth` showing the expiry  |
| 1. Records written and re-read                                 | records multicall tx `0x…`                                                          |
| 2. Second account, same World ID                               | screenshot of `HUMAN_ALREADY_PRESENT`; no new trip row                              |
| 3. Kenji hosts a dinner: table record written by the concierge | `setText(friendship.table)` tx `0x…` (from = concierge wallet)                      |
| 4. Maya asks to join: World ID for Agents approval             | production IDKit approval id / verification timestamp `…`; attendee row `requested` |
| 4. Kenji approves: his own step-up, record rewritten           | `setText(friendship.table)` tx `0x…` showing two attendees                          |
| 5. Ari declines the step-up                                    | approval row `denied`; record unchanged (same tx as above)                          |
| 5. An approval expires                                         | approval row `expired`; record unchanged                                            |
| 6. Concierge attempts `description`                            | revert reason `…` (smoke script output)                                             |
| 7. Split: shares resolved from names, Maya pays                | USDC `Transfer` tx `0x…`; attendee `paid_verified_at` set by the worker             |
| 8. Departure: the name expires                                 | ENS app or `getState` showing `AVAILABLE` after expiry; `trip.expire` tx `0x…`      |

## Screenshots to attach

1. Settings trip card with the live name, expiry and Etherscan link.
2. The World ID widget at activation and the duplicate-human error.
3. Tables list with the on-chain record link, and the table detail with the raw `friendship.table` JSON.
4. The approval modal in pending, denied and expired states.
5. The production World ID approval screen for an action.
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

## Mainnet payment evidence (unverified)

| Item                                                 | Evidence               |
| ---------------------------------------------------- | ---------------------- |
| Membership quote and provider order                  | Pending real execution |
| Base USDC source receipt                             | Pending real execution |
| Native 0G treasury receipt / call trace              | Pending real execution |
| One membership entitlement after confirmation policy | Pending real execution |
| Base/Ethereum USDC table share                       | Pending real execution |
| Restart and late-payment recovery                    | Pending real execution |
| Existing ENS mainnet name and description receipt    | Pending real execution |
