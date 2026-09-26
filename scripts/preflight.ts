import { access } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { productionRequirements } from "../src/server/config";
import { loadRuntimeSecrets } from "../src/server/secrets";
import { getDb, closeDb } from "../src/server/db";
import { checkoutStatus } from "../src/server/payments/adapter";
import { integrationReadiness } from "../src/server/integration-readiness";
async function main() {
  await loadRuntimeSecrets();
  const missing = productionRequirements();
  const integrations = integrationReadiness();
  console.log(JSON.stringify({ event: "preflight.integrations", ...integrations }));
  if (process.argv.includes("--require-live-integrations") && !integrations.configurationReady)
    process.exitCode = 1;
  if (process.argv.includes("--require-all-mainnet")) process.exitCode = 1;
  const fonts = ["public/fonts/AeonikPro-Regular.woff2", "public/fonts/AeonikPro-Medium.woff2"];
  const fontChecks = await Promise.all(
    fonts.map(async (file) => {
      try {
        await access(file);
        return true;
      } catch {
        return false;
      }
    }),
  );
  console.log(
    JSON.stringify({
      event: "preflight.configuration",
      missing,
      licensedFontsPresent: fontChecks.every(Boolean),
      liveCheckout: missing.length === 0 && checkoutStatus().enabled,
      ensConfigured:
        integrations.checks.find((check) => check.name === "ens")?.status === "configuration_ready",
    }),
  );
  if (missing.length) {
    process.exitCode = 1;
    return;
  }
  const db = await getDb();
  const counts = await db.execute(
    sql.raw(
      "SELECT (SELECT count(*)::int FROM users WHERE fixture) + (SELECT count(*)::int FROM places WHERE fixture) + (SELECT count(*)::int FROM events WHERE fixture) AS fixtures, (SELECT count(*)::int FROM places WHERE city = 'tokyo' AND published AND reviewed_at IS NOT NULL) AS tokyo_places",
    ),
  );
  const rows = (counts as { rows: { fixtures: number; tokyo_places: number }[] }).rows;
  console.log(JSON.stringify({ event: "preflight.content", result: rows }));
  const first = (rows as { fixtures: number; tokyo_places: number }[])[0];
  if (first.fixtures > 0 || first.tokyo_places < 20 || !fontChecks.every(Boolean))
    process.exitCode = 1;
  if (process.argv.includes("--require-payments") && !checkoutStatus().enabled)
    process.exitCode = 1;
  const alpha = await db.execute(
    sql.raw(
      "SELECT (SELECT count(*)::int FROM human_proofs WHERE environment <> 'production') AS nonproduction_proofs, (SELECT count(*)::int FROM users WHERE world_agent_issuer IS NOT NULL AND world_agent_issuer NOT LIKE 'world-id:%:production') AS nonproduction_identities, (SELECT count(*)::int FROM entitlements WHERE source = 'preview_grant' AND ends_at > now()) AS active_preview_grants",
    ),
  );
  const alphaRows = (
    alpha as {
      rows: {
        nonproduction_proofs: number;
        nonproduction_identities: number;
        active_preview_grants: number;
      }[];
    }
  ).rows;
  console.log(JSON.stringify({ event: "preflight.alpha_data", result: alphaRows }));
  if (alphaRows[0]?.nonproduction_proofs || alphaRows[0]?.nonproduction_identities)
    process.exitCode = 1;
  console.log(
    "This does not verify wallet UX, KMS permissions, refunds, policies, or sponsor eligibility. Complete docs/LAUNCH-CHECKLIST.md.",
  );
}
main()
  .catch(() => {
    console.error("Preflight failed. Review runtime configuration and database access.");
    process.exitCode = 1;
  })
  .finally(closeDb);
