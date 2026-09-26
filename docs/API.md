# API reference

Base path: `/api`. JSON responses are not cached. Production authentication uses `Authorization: Bearer <Privy access token>`. The local demo uses a signed HttpOnly cookie. Every mutation requires an exact same-origin `Origin` header. Bodies require `Content-Type: application/json` and are limited to 16 KiB. Dates are ISO strings; IDs are UUIDs.

Errors have this shape:

```json
{
  "error": {
    "code": "MEMBERSHIP_REQUIRED",
    "message": "...",
    "retryable": false,
    "correlationId": "..."
  }
}
```

## Read endpoints

| Method/path                                                     | Access                         | Result                                                          |
| --------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------- |
| GET `/health`                                                   | Public                         | Database health and runtime mode                                |
| GET `/config`                                                   | Public                         | Safe feature flags and local demo actor choices                 |
| GET `/cities`                                                   | Public                         | Published cities                                                |
| GET `/places?city=tokyo&category=Coffee&q=...&neighborhood=...` | Optional sign-in               | Preview or full authorized catalog                              |
| GET `/places/:slug`                                             | Preview public; otherwise paid | Place detail                                                    |
| GET `/events?city=tokyo`                                        | Public                         | Current/future published events                                 |
| GET `/plans`                                                    | Public                         | One global plan and checkout availability                       |
| GET `/me`                                                       | Signed in                      | Own profile, access, verified wallets and contact-presence flag |
| GET `/saves`                                                    | Signed in, including expired   | Saved library                                                   |
| GET `/members?city=tokyo&q=...`                                 | Paid                           | Discoverable members; `city=all` spans cities                   |
| GET `/members/:id`                                              | Paid                           | Allowed public profile                                          |
| GET `/requests`                                                 | Signed in, including expired   | Own requests and consented accepted contacts                    |
| GET `/now?city=tokyo`                                           | Paid                           | Active unexpired invitations                                    |
| GET `/blocks`                                                   | Signed in                      | Only blocks created by this member                              |
| GET `/invoices`                                                 | Signed in                      | Own recent invoice history                                      |
| GET `/invoices/:id`                                             | Owner                          | Safe invoice status; no quote secrets                           |
| GET `/ens/lookup?name=...`                                      | Paid + configured ENS          | Fresh Sepolia resolution to discoverable member                 |
| GET `/admin`                                                    | Admin                          | Bounded content/operations snapshot                             |

## Profile, social and content mutations

| Method/path                   | Required input / behavior                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PATCH `/me/profile`           | `name`, `role`, `bio`, `interests[]`, `intents[]`, `city`, `neighborhood`, `visible`, `adult:true`, `onboarded`; strict schema rejects role/admin assignment |
| PATCH `/me/visibility`        | `{visible:boolean}`; hiding also closes active invitations                                                                                                   |
| PUT `/me/contact`             | `{type:"Telegram"\|"Email",value,shareOnAcceptance}`; encrypted at rest                                                                                      |
| DELETE `/me/contact`          | Remove only the caller's stored contact                                                                                                                      |
| POST `/me/wallets`            | Refresh wallet links from Privy's server record                                                                                                              |
| POST `/saves`                 | `{type:"place"\|"event",id,saved:boolean}`                                                                                                                   |
| POST `/requests`              | `{recipientId,context,idempotencyKey,nowPostId?}`; sender must be paid with quota                                                                            |
| POST `/requests/:id/accept`   | Recipient only; no body required                                                                                                                             |
| POST `/requests/:id/decline`  | Recipient only                                                                                                                                               |
| POST `/requests/:id/cancel`   | Sender only                                                                                                                                                  |
| POST `/now`                   | `{kind,neighborhood,city,note,hours,placeId?}`; `hours` integer 1–6                                                                                          |
| DELETE `/now/:id`             | Owner only                                                                                                                                                   |
| POST `/blocks`                | `{targetId}`                                                                                                                                                 |
| DELETE `/blocks/:targetId`    | Removes only caller's block; idempotent                                                                                                                      |
| POST `/reports`               | `{targetId,reason}`; admin-only review                                                                                                                       |
| POST `/admin/places`          | `placeInput` schema in `src/server/admin.ts`; omit ID for create, supply for update                                                                          |
| POST `/admin/users/suspend`   | `{id,suspended}`; cannot suspend self                                                                                                                        |
| POST `/admin/reports/resolve` | `{id}`                                                                                                                                                       |
| POST `/admin/invoices/retry`  | `{id}`; queue verification, never grant access manually                                                                                                      |

Connection `kind`/interest values are defined in `src/lib/constants.ts`. City metadata and events are imported with the reviewed-content CLI. The admin JSON editor supports place create/update; it is intentionally a basic alpha tool.

## Payment and ENS mutations

| Method/path                   | Required input / behavior                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| POST `/invoices`              | `{sourceWallet,idempotencyKey}`; price fixed by server, wallet provider-verified             |
| POST `/invoices/:id/submit`   | `{sourceTx,providerOrderId}`; untrusted hint only. Late hints are retained in review.        |
| POST `/invoices/:id/simulate` | Demo only; no money moves                                                                    |
| POST `/ens/link`              | `{name}`; fresh name must resolve to linked wallet                                           |
| POST `/ens/description`       | `{name,description,consent:true}`; returns server intent ID plus unsigned chain/from/to/data |
| POST `/ens/confirm`           | `{intentId,txHash}`; checks exact transaction and re-reads record                            |

An expired ENS write intent must be refreshed; the app does not automatically resend transactions. A pending real payment must be reconciled, not silently retried as a new purchase.

The demo session endpoints are POST `/demo/session` with `{actor:"alex"\|"maya"\|"admin"}` and DELETE `/demo/session`. They return 404 outside local demo mode, and demo mode itself cannot run in a production process.

## ENSv2 trips, tables, World ID and the concierge

Added by the ENSv2 + World drop (`docs/ENS-WORLD-SPEC.md`, `docs/ENS-WORLD-DESIGN.md`). Same conventions as above. `GET /trips/:name` and `GET /world/agent/callback` are public; everything else needs a session. Demo-only routes return 404 outside `APP_MODE=demo`.

| Method/path                           | Access      | Behavior                                                                                                       |
| ------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| GET `/world/rp-context?action=`       | Signed in   | Server-signed IDKit `rp_context` for the widget; never generated in the browser                                |
| POST `/world/verify`                  | Paid        | `{city,label?,arrivesAt,departsAt,proof}`; verifies the World ID proof, mints the trip name; 201 with the trip |
| POST `/world/agent/link`              | Signed in   | Starts the one-time World ID for Agents link; returns an approval `{id,url,status}`                            |
| GET `/world/agent/callback`           | Public      | OIDC redirect target (`code`, `state`, `error`); finishes the approval, then 302 to `/approvals/:id`           |
| POST `/world/agent/simulate`          | Demo only   | `{approvalId,decision:"approve"\|"deny",human?}`; stands in for the World ID sandbox                           |
| GET `/trips/me?city=`                 | Signed in   | `{trip}` (active or registering) or `{trip:null}`                                                              |
| POST `/trips/extend`                  | Signed in   | `{city?,departsAt}`; forward only, renews the name on chain                                                    |
| POST `/trips/end`                     | Signed in   | `{city?}`; clears records and unregisters                                                                      |
| POST `/trips/pay-record`              | Signed in   | `{city?,enabled}`; writes or clears the 0G coin-type address record                                            |
| GET `/trips/:name`                    | Public      | `{name,city,active,departsAt,verifiedHuman,now}`; presence only, never account data                            |
| GET `/gatherings?city=`               | Paid        | Open, full and closed tables with host name, seats left and record links                                       |
| POST `/gatherings`                    | Paid + trip | `{city,kind,placeId?,area,startsAt,seats}`; 201 with the table; concierge writes the record                    |
| GET `/gatherings/:id`                 | Paid        | Attendees by name, split state, the raw `friendship.table` record                                              |
| POST `/gatherings/:id/request`        | Paid + trip | `{plusOnes}`; 201 with an approval; the attendee row exists only after approval                                |
| POST `/gatherings/:id/approve`        | Host        | `{attendeeId}`; 201 with an approval; the record is rewritten after approval                                   |
| POST `/gatherings/:id/decline`        | Host        | `{attendeeId}`                                                                                                 |
| POST `/gatherings/:id/leave`          | Member      | Leaves; the record is rewritten                                                                                |
| POST `/gatherings/:id/close`          | Host        | Closes the table                                                                                               |
| POST `/gatherings/:id/cancel`         | Host        | Cancels; the record is cleared                                                                                 |
| POST `/gatherings/:id/split`          | Host        | `{totalCents}`; equal shares, host address resolved from the trip name                                         |
| POST `/gatherings/:id/split/paid`     | Member      | `{txHash}`; a hint, verified from the chain by the worker                                                      |
| POST `/gatherings/:id/split/simulate` | Demo only   | Simulated USDC transfer from the member's wallet                                                               |
| POST `/concierge/chat`                | Paid        | `{city,message}`; `{reply,approvals,needsLink}`; nothing executes here                                         |
| POST `/concierge/now`                 | Paid + trip | `{city,kind,area,until}`; 201 with a `now.publish` approval                                                    |
| GET `/approvals/:id`                  | Owner       | Approval status (`pending`, `approved`, `consumed`, `denied`, `expired`)                                       |
| POST `/api/mcp`                       | Public      | JSON-RPC 2.0 Model Context Protocol, read-only tools `resolveTrip`, `openTables`, `whoIsAround`                |

`GET /config` additionally returns `world` (enabled, app id, RP id, environment, action, agentsEnabled, simulated), `ensParent`, `splitOgPayEnabled` and `origin`. Public member DTOs gain `tripName`, `verifiedHuman` and `now`; `GET /me` gains `user.verifiedHuman` and `user.worldAgentLinked`.
