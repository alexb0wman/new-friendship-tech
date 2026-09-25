# GCP deployment handoff

No live infrastructure was changed for this handoff. These steps are for the operator with access to the existing GCE/PM2 environment. Preserve shared services and the existing database cluster.

## Prepare a dedicated release

1. Confirm the target VM, domain, application port, Unix service user and existing proxy conventions. Keep those private values outside this public repository.
2. Create a dedicated PostgreSQL 16 database and least-privilege application role. Use a separate migration role if that is the existing operating standard. Do not use a shared superuser connection for the application.
3. Take a restorable database backup before schema changes. Verify free memory/disk and avoid rebuilding in an actively served directory.
4. Extract/checkout into a new immutable release directory. Use Node 22. `npm ci` installs the lockfile exactly. Keep development dependencies on the VM while the worker uses tsx and migrations run; do not use `npm ci --omit=dev` with this PM2 config.
5. Supply public build variables: production app mode, public Privy app ID, and any explicitly browser-safe RPC endpoint. Run `npm run typecheck`, `npm test` and `npm run build`. Public variables are compiled into the client bundle and cannot be corrected only by changing PM2 runtime values.
6. Set public runtime settings plus `SECRET_ENV_MAP` resource references. The attached service account resolves secrets inside the process. No key JSON file is required on GCE. Keep application and worker secret access narrowly scoped.
7. Run `npm run db:migrate` against the dedicated database. The migration command serializes itself with a PostgreSQL advisory lock. Do not run destructive schema push commands against production.
8. Validate owner-provided content with `npm run content:import -- content/your-local-reviewed.json`. Inspect the counts, then add `--apply`. The importer uses stable place slugs, retains existing IDs and writes atomically. It does not import newsletters, scrape Google Maps or fetch untrusted source URLs.
9. Start the application on an isolated loopback port with `deploy/ecosystem.config.cjs`. Set `NFTECH_RELEASE_DIR` to the absolute release path. The config uses port 3100; change it if already assigned. App and worker have unique names and memory limits.
10. Verify health and private/public access through the candidate route. Bootstrap the intended existing account as admin using `npm run admin:bootstrap -- --subject=did:privy:...`, inspect the printed account ID, then add `--apply`.
11. Complete browser, KMS, ENS and payment integration exercises and `npm run preflight -- --require-payments`. Review the concrete release and ingress change before any production cutover. Live paid checkout must remain closed while the adapter is incomplete.

## Runtime configuration example

Use resource names specific to your project; these are placeholders:

```json
{
  "DATABASE_URL": "projects/PROJECT_ID/secrets/NFTECH_DATABASE_URL/versions/latest",
  "PRIVY_APP_SECRET": "projects/PROJECT_ID/secrets/NFTECH_PRIVY_APP_SECRET/versions/latest",
  "ENS_SEPOLIA_RPC_URL": "projects/PROJECT_ID/secrets/NFTECH_ENS_RPC/versions/latest"
}
```

This JSON is a value for `SECRET_ENV_MAP`. Do not put actual passwords or tokens in it. Existing ADC and KMS settings belong to the VM's intended service identity. Secret rotation requires controlled process restart because values are loaded once per process. Confirm the Privy app IDs match across build and runtime.

## Ingress, headers and CSP

Use TLS on the actual app domain. The supplied Nginx snippet is a location example, not a replacement for the shared proxy configuration. The app binds loopback. Overwrite incoming client-IP headers before trusting them. `TRUST_PROXY` is false by default; enabling it requires a verified ingress chain that supplies a trusted `CF-Connecting-IP` value. Otherwise use a deliberately implemented trusted-proxy identity function appropriate to the actual environment.

Security headers include frame denial, nosniff, referrer policy and disabled camera/microphone/geolocation. A restrictive Content Security Policy is **not yet configured**: Privy and wallet frames/connect endpoints need a tested provider-specific policy. Add and validate it in report-only mode against the actual enabled providers, then enforce it. Do not add broad wildcards or `unsafe-eval` solely to make a failed login disappear.

## Logs and monitoring

Forward the two dedicated PM2 process logs to Cloud Logging using the VM's existing Ops Agent. Add a dedicated receiver/pipeline without replacing shared logging configuration. Include service name, environment and release ID as structured labels at ingestion.

Application error logs contain event, correlation ID and error class only. The worker emits heartbeat and safe retry classifications. Alert on absent worker heartbeat, health failure, sustained 5xx, reconciliation backlog, review-required invoices, database connection saturation and memory restarts. Limit log retention and operator access for correlation and audit records. Do not log Privy tokens, RPC URLs containing keys, contacts, message bodies or full invoices.

## Rollback

Keep the previous release intact and record its commit ID. Repoint only the dedicated PM2 application/worker to that release and reload them; do not restart unrelated processes. Ingress rollback must restore only the dedicated app route. Schema migrations are additive for this initial build; do not assume binary rollback can reverse future migrations. Test restoration from backup in an isolated database before launch. Never delete payment records to resolve a reconciliation error.

Stop new checkout initiation through the checkout kill switch when an issue is suspected, while leaving the reconciliation worker able to finish existing submissions. The current code already keeps real checkout closed.
