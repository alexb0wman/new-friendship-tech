import { AppError } from "@/server/errors";

export type Signer = "operator" | "concierge";
export type RecordWrite =
  | { type: "text"; key: string; value: string }
  | { type: "addr"; coinType: number; address: string };
export interface TxSubmission {
  hash: string;
  from: string;
  to: string;
  calldata: string;
}
export interface Receipt {
  status: "success" | "reverted" | "pending";
  from?: string;
  to?: string;
  input?: string;
  blockNumber?: number;
}
export interface TripState {
  status: "available" | "reserved" | "registered";
  expiry: number;
  owner: string | null;
}
export interface Erc20Transfer {
  txHash: string;
  from: string;
  to: string;
  amount: bigint;
  token: string;
  success: boolean;
  finalized: boolean;
}
/** A revert, simulated or real. `reason` is the decoded error name or the node's short message. */
export class ChainRevert extends AppError {
  constructor(public reason: string) {
    super("CHAIN_REVERT", "The chain rejected this write: " + reason, 409);
  }
}
export interface ChainAddresses {
  operator: string;
  concierge: string;
  cityRegistry: string;
  appResolver: string;
  usdc: string;
}
/**
 * Everything the app needs from ENSv2 and the settlement token, behind one interface so demo mode
 * and the test suite run on an in-memory chain while production talks to Sepolia. Names passed in
 * are full ENS names; labels are single labels in the Tokyo city registry.
 */
export interface ChainAdapter {
  readonly kind: "simulated" | "sepolia";
  readonly addresses: ChainAddresses;
  registerTrip(input: {
    city: string;
    label: string;
    owner: string;
    expiry: number;
  }): Promise<TxSubmission>;
  renewTrip(input: { city: string; label: string; expiry: number }): Promise<TxSubmission>;
  unregisterTrip(input: { city: string; label: string }): Promise<TxSubmission>;
  setRecords(signer: Signer, name: string, records: RecordWrite[]): Promise<TxSubmission>;
  simulateSetText(signer: Signer, name: string, key: string, value: string): Promise<void>;
  readText(name: string, key: string): Promise<string | null>;
  readAddr(name: string, coinType?: number): Promise<string | null>;
  tripState(input: { city: string; label: string }): Promise<TripState>;
  receipt(hash: string): Promise<Receipt>;
  erc20Transfer(hash: string): Promise<Erc20Transfer | null>;
  /** Simulated chain only: record a token transfer the split verifier can find. */
  simulateTransfer?(input: { from: string; to: string; amount: bigint }): Promise<TxSubmission>;
}
