import { randomBytes } from "node:crypto";
import { invariant } from "@/server/errors";
import { isDemo } from "@/server/config";
import {
  encodeMulticall,
  encodeRecordCalls,
  encodeRegister,
  encodeRenew,
  encodeUnregister,
} from "./encode";
import { tripName } from "./names";
import { isConciergeKey } from "./roles";
import {
  ChainRevert,
  type ChainAdapter,
  type Erc20Transfer,
  type Receipt,
  type RecordWrite,
  type Signer,
  type TripState,
  type TxSubmission,
} from "./types";

/**
 * An in-memory ENSv2 city registry plus app resolver with the role scoping that matters for the
 * demo: the operator may write anything, the concierge may write friendship.now and friendship.table
 * and nothing else. Expired trip names stop resolving, like the real registry walk. State lives on
 * globalThis so Next's dev reloads and the in-process demo worker share it; the demo resets on restart.
 */
export const SIM = {
  operator: "0x00000000000000000000000000000000000000a1",
  concierge: "0x00000000000000000000000000000000000000c1",
  cityRegistry: "0x0000000000000000000000000000000000000c17",
  appResolver: "0x00000000000000000000000000000000000000e5",
  usdc: "0x0000000000000000000000000000000000000d0c",
} as const;
interface Entry {
  city: string;
  owner: string;
  expiry: number;
  resolver: string;
}
interface Records {
  text: Map<string, string>;
  addr: Map<number, string>;
}
interface Tx {
  from: string;
  to: string;
  input: string;
  status: "success" | "reverted";
  block: number;
}
interface State {
  entries: Map<string, Entry>;
  records: Map<string, Records>;
  txs: Map<string, Tx>;
  transfers: Map<string, Erc20Transfer>;
  block: number;
}
const runtime = globalThis as typeof globalThis & { __nftechSimChain?: State };
const fresh = (): State => ({
  entries: new Map(),
  records: new Map(),
  txs: new Map(),
  transfers: new Map(),
  block: 1,
});
const state = () => (runtime.__nftechSimChain ??= fresh());
export function resetSimulatedChain() {
  runtime.__nftechSimChain = fresh();
}
const entryKey = (city: string, label: string) => city + "/" + label;
const now = () => Math.floor(Date.now() / 1000);
function mine(from: string, to: string, input: string): TxSubmission {
  const hash = "0x" + randomBytes(32).toString("hex");
  const s = state();
  s.block += 1;
  s.txs.set(hash, { from, to, input, status: "success", block: s.block });
  return { hash, from, to, calldata: input };
}
/** A trip name whose registry entry has expired (or was unregistered) resolves to nothing. */
function expiredTrip(name: string): boolean {
  for (const [key, entry] of state().entries) {
    const label = key.slice(entry.city.length + 1);
    if (tripName(entry.city, label) === name) return entry.expiry <= now();
  }
  return false;
}
function assertSignerMay(signer: Signer, records: RecordWrite[]) {
  if (signer === "operator") return;
  for (const record of records)
    if (record.type !== "text" || !isConciergeKey(record.key))
      throw new ChainRevert("EACUnauthorizedAccountRoles");
}
class SimulatedChain implements ChainAdapter {
  readonly kind = "simulated" as const;
  readonly addresses = {
    operator: SIM.operator,
    concierge: SIM.concierge,
    cityRegistry: SIM.cityRegistry,
    appResolver: SIM.appResolver,
    usdc: SIM.usdc,
  };
  private signerAddress(signer: Signer) {
    return signer === "operator" ? SIM.operator : SIM.concierge;
  }
  async registerTrip(input: { city: string; label: string; owner: string; expiry: number }) {
    const key = entryKey(input.city, input.label),
      existing = state().entries.get(key);
    if (existing && existing.expiry > now()) throw new ChainRevert("NameAlreadyRegistered");
    if (input.expiry <= now()) throw new ChainRevert("CannotSetPastExpiration");
    state().entries.set(key, {
      city: input.city,
      owner: input.owner.toLowerCase(),
      expiry: input.expiry,
      resolver: SIM.appResolver,
    });
    // Re-registration starts fresh: the old bundle is gone, like a new token with new roles.
    state().records.delete(tripName(input.city, input.label));
    return mine(
      SIM.operator,
      SIM.cityRegistry,
      encodeRegister({
        label: input.label,
        owner: input.owner,
        registry: "0x0000000000000000000000000000000000000000",
        resolver: SIM.appResolver,
        roleBitmap: 0n,
        expiry: input.expiry,
      }),
    );
  }
  async renewTrip(input: { city: string; label: string; expiry: number }) {
    const entry = state().entries.get(entryKey(input.city, input.label));
    if (!entry) throw new ChainRevert("NameNotRegistered");
    if (input.expiry < entry.expiry) throw new ChainRevert("CannotReduceExpiration");
    entry.expiry = input.expiry;
    return mine(SIM.operator, SIM.cityRegistry, encodeRenew(input.label, input.expiry));
  }
  async unregisterTrip(input: { city: string; label: string }) {
    const entry = state().entries.get(entryKey(input.city, input.label));
    if (!entry) throw new ChainRevert("NameNotRegistered");
    entry.expiry = now();
    return mine(SIM.operator, SIM.cityRegistry, encodeUnregister(input.label));
  }
  async setRecords(signer: Signer, name: string, records: RecordWrite[]) {
    assertSignerMay(signer, records);
    const bundle = state().records.get(name) ?? { text: new Map(), addr: new Map() };
    for (const record of records)
      if (record.type === "text") bundle.text.set(record.key, record.value);
      else bundle.addr.set(record.coinType, record.address.toLowerCase());
    state().records.set(name, bundle);
    return mine(
      this.signerAddress(signer),
      SIM.appResolver,
      encodeMulticall(encodeRecordCalls(name, records)),
    );
  }
  async simulateSetText(signer: Signer, _name: string, key: string, value: string) {
    assertSignerMay(signer, [{ type: "text", key, value }]);
  }
  async readText(name: string, key: string) {
    if (expiredTrip(name)) return null;
    const value = state().records.get(name)?.text.get(key);
    return value ? value : null;
  }
  async readAddr(name: string, coinType = 60) {
    if (expiredTrip(name)) return null;
    const value = state().records.get(name)?.addr.get(coinType);
    return value ? value : null;
  }
  async tripState(input: { city: string; label: string }): Promise<TripState> {
    const entry = state().entries.get(entryKey(input.city, input.label));
    if (!entry || entry.expiry <= now())
      return { status: "available", expiry: entry?.expiry ?? 0, owner: null };
    return { status: "registered", expiry: entry.expiry, owner: entry.owner };
  }
  async receipt(hash: string): Promise<Receipt> {
    const tx = state().txs.get(hash);
    if (!tx) return { status: "pending" };
    return { status: tx.status, from: tx.from, to: tx.to, input: tx.input, blockNumber: tx.block };
  }
  async erc20Transfer(hash: string) {
    return state().transfers.get(hash) ?? null;
  }
  async simulateTransfer(input: { from: string; to: string; amount: bigint }) {
    invariant(isDemo(), "NOT_FOUND", "Not found.", 404);
    const submission = mine(input.from.toLowerCase(), SIM.usdc, "0xa9059cbb");
    state().transfers.set(submission.hash, {
      txHash: submission.hash,
      from: input.from.toLowerCase(),
      to: input.to.toLowerCase(),
      amount: input.amount,
      token: SIM.usdc,
      success: true,
      finalized: true,
    });
    return submission;
  }
}
let instance: SimulatedChain | undefined;
export function simulatedChain(): ChainAdapter {
  return (instance ??= new SimulatedChain());
}
