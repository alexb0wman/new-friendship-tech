import { randomUUID } from "node:crypto";
import { runWorkerOnce } from "@/server/payments/service";
import { runEnsWorkerOnce } from "@/server/ens-v2/jobs";
import "@/server/ens-world/handlers";
import { expireTrips } from "@/server/ens-world/trips";
import { closeDb } from "@/server/db";
import { isDemo, assertRuntimeSafety } from "@/server/config";
import { loadRuntimeSecrets } from "@/server/secrets";
const workerId = randomUUID();
let running = true;
process.on("SIGTERM", () => {
  running = false;
});
process.on("SIGINT", () => {
  running = false;
});
async function main() {
  await loadRuntimeSecrets();
  assertRuntimeSafety();
  if (isDemo())
    throw new Error("The isolated demo reconciles in-process. A separate worker needs PostgreSQL.");
  while (running) {
    try {
      await expireTrips();
      const paymentsWorked = await runWorkerOnce(workerId);
      const ensWorked = await runEnsWorkerOnce(workerId);
      const worked = paymentsWorked || ensWorked;
      console.log(
        JSON.stringify({
          event: "worker.heartbeat",
          workerId,
          worked,
          at: new Date().toISOString(),
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, worked ? 1000 : 5000));
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "worker.error",
          kind: error instanceof Error ? error.name : "unknown",
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  await closeDb();
}
main().catch(() => {
  console.error("Worker failed to start");
  process.exitCode = 1;
});
