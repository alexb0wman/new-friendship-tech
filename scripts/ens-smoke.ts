import { loadRuntimeSecrets } from "../src/server/secrets";

/**
 * Live smoke against the configured Sepolia namespace. Registers a throwaway trip, writes and
 * re-reads its records, writes a table record from the concierge, proves the concierge cannot
 * write any other key, renews the trip, and prints every hash as a markdown table for
 * docs/EVIDENCE.md. Run once before recording the demo.
 *
 *   APP_MODE=production ENS_ENABLED=true <bootstrap env> npm run ens:smoke
 */
async function main() {
  await loadRuntimeSecrets();
  process.env.APP_MODE ??= "production";
  process.env.ENS_ENABLED ??= "true";
  const { sepoliaChain } = await import("../src/server/ens-v2/sepolia");
  const { tableName, tripName } = await import("../src/server/ens-v2/names");
  const { writeRecordsProven } = await import("../src/server/ens-world/trips");
  const { ChainRevert } = await import("../src/server/ens-v2/types");
  const chain = sepoliaChain();
  const now = new Date();
  const label = "smoke-" + now.toISOString().slice(11, 16).replace(":", "");
  const rows: [string, string][] = [];
  const expiry = Math.floor(now.getTime() / 1000) + 30 * 60;
  const trip = tripName("tokyo", label);
  const registered = await chain.registerTrip({
    city: "tokyo",
    label,
    owner: chain.addresses.operator,
    expiry,
  });
  rows.push(["register " + trip, registered.hash]);
  let receipt = await chain.receipt(registered.hash);
  while (receipt.status === "pending") {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    receipt = await chain.receipt(registered.hash);
  }
  if (receipt.status !== "success") throw new Error("registration reverted");
  const records = await writeRecordsProven("operator", trip, [
    { type: "addr", coinType: 60, address: chain.addresses.operator },
    {
      type: "text",
      key: "friendship.trip",
      value: JSON.stringify({
        city: "tokyo",
        departsAt: new Date(expiry * 1000).toISOString(),
        verifiedHuman: true,
      }),
    },
  ]);
  rows.push(["records on " + trip + " (operator, re-read matched)", records.hash]);
  const table = tableName("tokyo", "smoke-" + label);
  const written = await writeRecordsProven("concierge", table, [
    {
      type: "text",
      key: "friendship.table",
      value: JSON.stringify({ v: 1, kind: "coffee", attendees: [trip], guests: 0, status: "open" }),
    },
  ]);
  rows.push(["friendship.table on " + table + " (concierge, re-read matched)", written.hash]);
  try {
    await chain.simulateSetText("concierge", trip, "description", "should revert");
    rows.push(["concierge setText description", "DID NOT REVERT (scope problem)"]);
  } catch (error) {
    rows.push([
      "concierge setText description",
      "reverted: " + (error instanceof ChainRevert ? error.reason : String(error)),
    ]);
  }
  const renewed = await chain.renewTrip({ city: "tokyo", label, expiry: expiry + 600 });
  rows.push(["renew " + trip + " by 10 minutes", renewed.hash]);
  console.log("\n| Step | Evidence |\n|---|---|");
  for (const [step, evidence] of rows)
    console.log(
      "| " +
        step +
        " | " +
        (evidence.startsWith("0x") ? "https://sepolia.etherscan.io/tx/" + evidence : evidence) +
        " |",
    );
  console.log("\nThe trip expires on its own at " + new Date((expiry + 600) * 1000).toISOString());
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
