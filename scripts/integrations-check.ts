import { loadRuntimeSecrets } from "../src/server/secrets";
import { integrationReadiness } from "../src/server/integration-readiness";

async function main() {
  await loadRuntimeSecrets();
  const report = integrationReadiness();
  console.log(JSON.stringify(report, null, 2));
  if (!report.configurationReady || process.argv.includes("--require-all-mainnet"))
    process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Integration configuration check failed. Check runtime secret access; no secret values are printed.",
  );
  process.exitCode = 1;
});
