import { isDemo, previewEns } from "@/server/config";
import { sepoliaChain } from "./sepolia";
import { simulatedChain } from "./simulated";
import type { ChainAdapter } from "./types";

export type {
  ChainAdapter,
  ChainAddresses,
  Erc20Transfer,
  Receipt,
  RecordWrite,
  Signer,
  TripState,
  TxSubmission,
} from "./types";
export { ChainRevert } from "./types";
export { resetSimulatedChain, SIM } from "./simulated";

/** Demo mode and the test suite run on the in-memory chain; anything else is Sepolia or a 503. */
export function chain(): ChainAdapter {
  return isDemo() || previewEns() ? simulatedChain() : sepoliaChain();
}
