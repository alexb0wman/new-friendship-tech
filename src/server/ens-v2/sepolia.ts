import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  parseEventLogs,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { AppError, invariant } from "@/server/errors";
import { config } from "@/server/config";
import { registryAbi, resolverAbi } from "./abi";
import { SEPOLIA, ensWorldEnv, type EnsWorldEnv } from "./addresses";
import {
  encodeMulticall,
  encodeRecordCalls,
  encodeRegister,
  encodeRenew,
  encodeUnregister,
} from "./encode";
import { dnsName, labelId } from "./names";
import { TRIP_OWNER_BITMAP } from "./roles";
import {
  ChainRevert,
  type ChainAdapter,
  type Receipt,
  type RecordWrite,
  type Signer,
  type TripState,
  type TxSubmission,
} from "./types";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
function revertReason(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { data?: { errorName?: string }; shortMessage?: string; name?: string };
    if (e.data?.errorName) return e.data.errorName;
    if (e.shortMessage) return e.shortMessage.slice(0, 200);
    if (e.name) return e.name;
  }
  return "unknown";
}
/**
 * Sepolia ENSv2 beta: the city registry (a UserRegistry proxy) and the shared app resolver
 * (a PermissionedResolver proxy), with two wallets. The operator registers and writes member
 * records; the concierge holds setter roles for two text keys and nothing else.
 */
class SepoliaChain implements ChainAdapter {
  readonly kind = "sepolia" as const;
  readonly addresses;
  private readonly env: EnsWorldEnv;
  private readonly publicClient: PublicClient;
  private readonly wallets: Record<Signer, WalletClient>;
  constructor(env: EnsWorldEnv) {
    this.env = env;
    const transport = http(env.rpcUrl, { timeout: 15000, retryCount: 1 });
    this.publicClient = createPublicClient({ chain: sepolia, transport, ccipRead: false });
    const operator = privateKeyToAccount(env.operatorKey),
      concierge = privateKeyToAccount(env.conciergeKey);
    this.wallets = {
      operator: createWalletClient({ account: operator, chain: sepolia, transport }),
      concierge: createWalletClient({ account: concierge, chain: sepolia, transport }),
    };
    this.addresses = {
      operator: operator.address.toLowerCase(),
      concierge: concierge.address.toLowerCase(),
      cityRegistry: env.cityRegistryTokyo,
      appResolver: env.appResolver,
      usdc: SEPOLIA.mockUsdc,
    };
  }
  private registryFor(city: string): Address {
    invariant(city === "tokyo", "ENS_CITY_UNAVAILABLE", "Only Tokyo has a registry in v1.", 503);
    return this.env.cityRegistryTokyo as Address;
  }
  private async submit(signer: Signer, to: Address, data: Hex): Promise<TxSubmission> {
    const wallet = this.wallets[signer],
      account = wallet.account!;
    try {
      await this.publicClient.call({ account, to, data });
    } catch (error) {
      throw new ChainRevert(revertReason(error));
    }
    const hash = await wallet.sendTransaction({ account, chain: sepolia, to, data });
    return { hash, from: account.address.toLowerCase(), to: to.toLowerCase(), calldata: data };
  }
  async registerTrip(input: { city: string; label: string; owner: string; expiry: number }) {
    // No transfer role and no subregistry role: the trip is soulbound and cannot mint sub-trips.
    const data = encodeRegister({
      label: input.label,
      owner: input.owner,
      registry: ZERO,
      resolver: this.env.appResolver,
      roleBitmap: TRIP_OWNER_BITMAP,
      expiry: input.expiry,
    });
    return this.submit("operator", this.registryFor(input.city), data);
  }
  async renewTrip(input: { city: string; label: string; expiry: number }) {
    return this.submit(
      "operator",
      this.registryFor(input.city),
      encodeRenew(input.label, input.expiry),
    );
  }
  async unregisterTrip(input: { city: string; label: string }) {
    return this.submit("operator", this.registryFor(input.city), encodeUnregister(input.label));
  }
  async setRecords(signer: Signer, name: string, records: RecordWrite[]) {
    return this.submit(
      signer,
      this.env.appResolver as Address,
      encodeMulticall(encodeRecordCalls(name, records)),
    );
  }
  async simulateSetText(signer: Signer, name: string, key: string, value: string) {
    try {
      await this.publicClient.simulateContract({
        address: this.env.appResolver as Address,
        abi: resolverAbi,
        functionName: "setText",
        args: [dnsName(name), key, value],
        account: this.wallets[signer].account,
      });
    } catch (error) {
      throw new ChainRevert(revertReason(error));
    }
  }
  async readText(name: string, key: string) {
    const value = await this.publicClient.getEnsText({
      name,
      key,
      universalResolverAddress: SEPOLIA.universalResolverProxy,
    });
    return value ? value : null;
  }
  async readAddr(name: string, coinType = 60) {
    const value = await this.publicClient.getEnsAddress({
      name,
      coinType: BigInt(coinType),
      universalResolverAddress: SEPOLIA.universalResolverProxy,
    });
    return value && value !== ZERO ? value.toLowerCase() : null;
  }
  async tripState(input: { city: string; label: string }): Promise<TripState> {
    const state = await this.publicClient.readContract({
      address: this.registryFor(input.city),
      abi: registryAbi,
      functionName: "getState",
      args: [labelId(input.label)],
    });
    const status = (["available", "reserved", "registered"] as const)[state.status] ?? "available";
    return {
      status,
      expiry: Number(state.expiry),
      owner: status === "registered" ? state.latestOwner.toLowerCase() : null,
    };
  }
  async receipt(hash: string): Promise<Receipt> {
    try {
      const [receipt, tx] = await Promise.all([
        this.publicClient.getTransactionReceipt({ hash: hash as Hash }),
        this.publicClient.getTransaction({ hash: hash as Hash }),
      ]);
      return {
        status: receipt.status === "success" ? "success" : "reverted",
        from: tx.from.toLowerCase(),
        to: tx.to?.toLowerCase(),
        input: tx.input,
        blockNumber: Number(receipt.blockNumber),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      return { status: "pending" };
    }
  }
  async erc20Transfer(hash: string) {
    let receipt;
    try {
      receipt = await this.publicClient.getTransactionReceipt({ hash: hash as Hash });
    } catch {
      return null;
    }
    const logs = parseEventLogs({
      abi: erc20Abi,
      eventName: "Transfer",
      logs: receipt.logs,
    }).filter((log) => log.address.toLowerCase() === SEPOLIA.mockUsdc);
    const transfer = logs[0];
    if (!transfer) return null;
    const latest = await this.publicClient.getBlockNumber();
    return {
      txHash: hash,
      from: transfer.args.from.toLowerCase(),
      to: transfer.args.to.toLowerCase(),
      amount: transfer.args.value,
      token: SEPOLIA.mockUsdc,
      success: receipt.status === "success",
      finalized: latest - receipt.blockNumber >= 2n,
    };
  }
}
let instance: SepoliaChain | undefined;
export function sepoliaChain(): ChainAdapter {
  const env = ensWorldEnv();
  invariant(
    config().ensEnabled && env,
    "ENS_UNAVAILABLE",
    "ENSv2 Sepolia is not configured: set ENS_ENABLED, the RPC URL, registry and resolver addresses and both wallet keys.",
    503,
  );
  return (instance ??= new SepoliaChain(env));
}
