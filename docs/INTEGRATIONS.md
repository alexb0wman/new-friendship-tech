# Integration contracts and remaining work

## Privy

Implemented: client provider; email and wallet sign-in; server access-token verification with `@privy-io/node`; unique subject enrollment; server-owned wallet association. Configure the same app ID in `NEXT_PUBLIC_PRIVY_APP_ID` at build time and `PRIVY_APP_ID` at runtime. Keep the secret server-only. Add the exact app origin to Privy's allowed origins. Configure the desired email and embedded-wallet settings in the provider dashboard.

Test email login, external wallet login, logout, refresh, expired tokens, wallet unlink/relink, duplicate-account recovery and mobile wallet return navigation. Automatic account merging is deliberately absent. Admin support must review identity conflicts.

Official reference: https://docs.privy.io/

## ENSv2 / Sepolia

Implemented in `src/server/ens.ts`:

- ENSIP normalization through viem.
- Chain-ID verification and fresh name/address/resolver reads.
- Linking only a name resolving to a Privy-verified wallet.
- Private app lookup by a normalized name.
- Description text-record preparation after `simulateContract` checks actual resolver permissions.
- Wallet-signed transaction submission in settings, followed by receipt checking and fresh resolution.

Configure `ENS_ENABLED`, `ENS_SEPOLIA_RPC_URL`, and optionally `ENS_WRITE_ENABLED`. Configure the public RPC URL only if a public/browser-safe endpoint is intended. Use viem's current Sepolia chain contracts; do not paste an old universal resolver address into the integration. No private contact or member graph is written on-chain.

**Not complete:** a controlled ENSv2 parent namespace; registrar/role provisioning; subname issuance; a tested user name; live contract transaction evidence; judge-specific eligibility confirmation. This code is not proof of a prize-eligible ENSv2 integration merely because an ENS call succeeds. Verify that the chosen name uses the intended ENSv2 deployment and that the demonstrated operation matches the current sponsor criteria.

CCIP Read is disabled server-side. Off-chain gateway records fail with an explicit unsupported/error state. Supporting them later needs an SSRF-aware gateway strategy, timeouts and response validation, not a blanket server fetch.

Record writes now create a server-owned, twenty-minute intent containing account, normalized name, source wallet, resolver, chain, exact calldata and description. Confirmation requires a successful receipt, matching sender/recipient/input, zero native value, the correct chain, unchanged resolver and an independent text-record re-read. A unique transaction hash cannot confirm multiple intents. Local proof tests cover altered transactions; actual ENSv2 RPC and wallet execution still need live verification.

Official references: https://docs.ens.domains/ and the current event sponsor page.

## 0G Pay — the critical remaining integration

The exact SDK is installed and a typed `OgPayTrigger` component exists. The live checkout does **not mount it yet**. The component is a provider UI boundary, not a merchant settlement implementation. Current public SDK configuration uses developer mode, a recipient, crypto methods, `EXACT_INPUT`, and an output amount. Resolve the provider's actual USD-to-settlement quote semantics before wiring the amount prop; do not label a floating-output route a guaranteed $19 merchant receipt.

`OgPayMerchantAdapter.quote()` and `.inspect()` intentionally return `PAYMENT_ROUTE_UNVERIFIED`. `checkoutStatus()` stays closed even if an environment flag is changed. Real invoices cannot accidentally fall back to the demo adapter.

Complete these concrete tasks:

1. Obtain the official merchant/developer route contract and supported mainnet chain/asset/recipient configuration. Confirm the merchant recipient can actually be set in the chosen server quote path. The public wallet-funding route is not automatically a merchant checkout route.
2. Implement server-owned quotes containing source account, quote/order identifier, destination chain, token/native asset, recipient, integer base-unit amount, allowed fee/slippage policy and expiry. Never accept a browser price.
3. Pass the exact server quote into the provider UI using the documented merchant invocation. Extract callback source/order hints from the real typed callback schema, not guessed fields.
4. Implement adapter inspection: retrieve the provider order through an authenticated or independently authenticated route; verify the source wallet/order/quote relationship; independently read destination receipts and the relevant transfer/order event on the intended chain. Validate native-value versus ERC20 log behavior explicitly.
5. For sponsored/relayed funding, verify the authenticated user's source-wallet relationship according to the provider's actual mechanism. Do not naively require the destination transaction sender to equal the user wallet.
6. Define provider finality requirements, reorganization handling, quote-expiry behavior and refund/manual-review policy. Preserve late-payment references for reconciliation; never tell a customer to pay again simply because a callback arrived late.
7. Test wrong chain/token/recipient/amount/order, callback before settlement, app restart, provider timeout, duplicate settlement across invoices, late payment and interrupted mobile return. Use the existing domain tests as a base, then add adapter integration tests with genuine provider fixtures.
8. Mount the provider component only after these checks. Enable the server checkout predicate from verified configuration. Make one explicitly authorized small real purchase with an operator-controlled wallet; independently inspect the merchant receipt and exercise the documented refund/support path.

The code exposes no action to authorize a transfer automatically. A wallet confirmation remains the user's explicit payment authorization. The application has no recurring debit approval and no Stripe integration.

Official reference: https://pay.0g.ai/docs

## KMS and Secret Manager

`src/server/secrets.ts` loads allowed named secrets through ADC using the attached GCE service account. A JSON `SECRET_ENV_MAP` maps server environment names to Secret Manager version resources. Values load within each app/worker child, keeping them out of PM2's persisted parent environment. Do not export actual secret values in the shell used for `pm2 start` or `pm2 save`.

Grant access only to the needed secret versions and the dedicated KMS key. Use the correct KMS encryption/decryption permissions. Test seal/decrypt, denied IAM, corrupt ciphertext, wrong-owner associated data and key rotation. The local crypto test does not call KMS.

## Design and content

Reference system: https://tbdstudio.framer.ai/ . The implementation adopts dark fields, editorial type, restrained borders, generous spacing and lime actions. It is an original implementation, not a scraped copy of the reference source or imagery.

Provide licensed `AeonikPro-Regular.woff2` and `AeonikPro-Medium.woff2` in `public/fonts`. Until then, typography falls back to system sans. Original SVG placeholders live in `public/art`; replace them with the supplied city branding and optimize dimensions/file sizes. Do not commit font binaries unless their license explicitly permits public redistribution.

The former brand references are context, not production data sources: https://urconduit.webflow.io/ and https://www.neighborhood.guide/ . No curated venue accuracy or map inventory import is claimed by the code.
