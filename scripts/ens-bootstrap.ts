import { writeFile } from "node:fs/promises";
import { privateKeyToAccount } from "viem/accounts";
import { bootstrap } from "../src/server/ens-v2/bootstrap";
import { loadRuntimeSecrets } from "../src/server/secrets";

/**
 * Provision the ENSv2 namespace on Sepolia. Run once per parent name, by the operator.
 *
 *   ENS_SEPOLIA_RPC_URL=... ENS_OPERATOR_PRIVATE_KEY=0x... ENS_CONCIERGE_PRIVATE_KEY=0x... \
 *   ENS_PARENT_NAME=<label>.eth APP_ORIGIN=https://app.example \
 *   npm run ens:bootstrap -- [--register-parent] [--version 0] [--out ens-bootstrap.output.json]
 *
 * Needs Sepolia ETH on the operator wallet. --register-parent also mints MockUSDC and runs the
 * commit-reveal registration for the parent (about 90 seconds). The output JSON is committed as
 * evidence and its env block goes into the deployment.
 */
function flag(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? "");
}
async function main() {
  await loadRuntimeSecrets();
  const rpcUrl = process.env.ENS_SEPOLIA_RPC_URL,
    operatorKey = process.env.ENS_OPERATOR_PRIVATE_KEY,
    conciergeKey = process.env.ENS_CONCIERGE_PRIVATE_KEY,
    parentName = process.env.ENS_PARENT_NAME,
    origin = process.env.APP_ORIGIN;
  if (!rpcUrl || !operatorKey || !conciergeKey || !parentName || !origin)
    throw new Error(
      "Set ENS_SEPOLIA_RPC_URL, ENS_OPERATOR_PRIVATE_KEY, ENS_CONCIERGE_PRIVATE_KEY, ENS_PARENT_NAME and APP_ORIGIN.",
    );
  const output = await bootstrap({
    rpcUrl,
    operatorKey: operatorKey as `0x${string}`,
    conciergeAddress: privateKeyToAccount(conciergeKey as `0x${string}`).address,
    parentName,
    origin,
    registerParent: process.argv.includes("--register-parent"),
    version: BigInt(flag("--version") ?? "0"),
    log: (line) => console.log(line),
  });
  const out = flag("--out") || "ens-bootstrap.output.json";
  await writeFile(out, JSON.stringify(output, null, 2) + "\n");
  console.log("\nwrote " + out + "\n");
  for (const [key, value] of Object.entries(output.env)) console.log(key + "=" + value);
  if (!output.conciergeScoped) process.exitCode = 2;
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
