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
  const { assertChainWriteProof, observedKey } = await import("../src/server/ens-v2/proof");
  const { ChainRevert } = await import("../src/server/ens-v2/types");
  const chain = sepoliaChain();
  const now = new Date();
  const label = "smoke-" + now.getTime().toString(36);
  const rows: [string, string][] = [];
  const expiry = Math.floor(now.getTime() / 1000) + 30 * 60;
  async function wait(hash: string) {
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
      const receipt = await chain.receipt(hash);
      if (receipt.status === "success") return receipt;
      if (receipt.status === "reverted") throw new Error("Transaction reverted: " + hash);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    throw new Error(
      "Transaction still pending after three minutes: " +
        hash +
        ". Check the explorer before retrying.",
    );
  }
  async function writeRecordsProven(
    signer: import("../src/server/ens-v2/types").Signer,
    name: string,
    records: import("../src/server/ens-v2/types").RecordWrite[],
  ) {
    const submission = await chain.setRecords(signer, name, records);
    const receipt = await wait(submission.hash);
    const observed: Record<string, string | null> = {};
    for (const record of records)
      observed[observedKey(record)] =
        record.type === "text"
          ? await chain.readText(name, record.key)
          : await chain.readAddr(name, record.coinType);
    assertChainWriteProof({ submission, receipt, expected: { records }, observed });
    return submission;
  }
  const trip = tripName("tokyo", label);
  const registered = await chain.registerTrip({
    city: "tokyo",
    label,
    owner: chain.addresses.operator,
    expiry,
  });
  rows.push(["register " + trip, registered.hash]);
  const receipt = await wait(registered.hash);
  assertChainWriteProof({
    submission: registered,
    receipt,
    expected: { records: [] },
    observed: {},
  });
  const state = await chain.tripState({ city: "tokyo", label });
  if (
    state.status !== "registered" ||
    state.owner !== chain.addresses.operator ||
    state.expiry !== expiry
  )
    throw new Error("Registered owner/expiry did not match the smoke request.");
  const records = await writeRecordsProven("operator", trip, [
    { type: "addr", coinType: 60, address: chain.addresses.operator },
    {
      type: "text",
      key: "friendship.trip",
      value: JSON.stringify({
        city: "tokyo",
        departsAt: new Date(expiry * 1000).toISOString(),
        smoke: true,
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
    throw new Error("The concierge can write description; its role scope is incorrect.");
  } catch (error) {
    if (!(error instanceof ChainRevert) || error.reason !== "EACUnauthorizedAccountRoles")
      throw error;
    rows.push([
      "concierge setText description",
      "reverted: " + (error instanceof ChainRevert ? error.reason : String(error)),
    ]);
  }
  const renewed = await chain.renewTrip({ city: "tokyo", label, expiry: expiry + 600 });
  const renewalReceipt = await wait(renewed.hash);
  assertChainWriteProof({
    submission: renewed,
    receipt: renewalReceipt,
    expected: { records: [] },
    observed: {},
  });
  if ((await chain.tripState({ city: "tokyo", label })).expiry !== expiry + 600)
    throw new Error("Renewal did not update the expiry.");
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
