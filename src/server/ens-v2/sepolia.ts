import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  parseEventLogs,
  keccak256,
  concatHex,
  nonceManager,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  BaseError,
  ContractFunctionRevertedError,
  ExecutionRevertedError,
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
import { SEPOLIA, ensWorldEnv, parentLabel, parentName, type EnsWorldEnv } from "./addresses";
import {
  encodeMulticall,
  encodeRecordCalls,
  encodeRegister,
  encodeRenew,
  encodeUnregister,
} from "./encode";
import { dnsName, labelId } from "./names";
import { TRIP_OWNER_BITMAP } from "./roles";
import { ensJobCheckpoint } from "./jobs";
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
export class SepoliaChain implements ChainAdapter {
  readonly kind = "sepolia" as const;
  readonly addresses;
  private readonly env: EnsWorldEnv;
  private readonly publicClient: PublicClient;
  private readonly wallets: Record<Signer, WalletClient>;
  constructor(env: EnsWorldEnv) {
    this.env = env;
    const transport = http(env.rpcUrl, { timeout: 15000, retryCount: 1 });
    this.publicClient = createPublicClient({ chain: sepolia, transport, ccipRead: false });
    const operator = privateKeyToAccount(env.operatorKey, { nonceManager }),
      concierge = privateKeyToAccount(env.conciergeKey, { nonceManager });
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
  private async assertNetwork() {
    invariant(
      (await this.publicClient.getChainId()) === sepolia.id,
      "ENS_CHAIN",
      "The ENSv2 namespace RPC must use Sepolia. ENSv2 is not deployed on mainnet.",
      503,
    );
  }
  private async assertNamespace() {
    await this.assertNetwork();
    const [parent, city] = await Promise.all([
      this.publicClient.readContract({
        address: SEPOLIA.ethRegistry,
        abi: registryAbi,
        functionName: "getSubregistry",
        args: [parentLabel()],
      }),
      this.publicClient.readContract({
        address: this.env.parentRegistry as Address,
        abi: registryAbi,
        functionName: "getSubregistry",
        args: ["tokyo"],
      }),
    ]);
    invariant(
      parent.toLowerCase() === this.env.parentRegistry.toLowerCase() &&
        city.toLowerCase() === this.env.cityRegistryTokyo.toLowerCase(),
      "ENS_NAMESPACE_CHANGED",
      "The ENSv2 namespace is not mounted at the configured registries. Run the namespace preflight.",
      503,
    );
  }
  private async submit(signer: Signer, to: Address, data: Hex): Promise<TxSubmission> {
    await this.assertNetwork();
    const code = await this.publicClient.getCode({ address: to });
    invariant(
      code && code !== "0x",
      "ENS_CONTRACT_MISSING",
      "The configured ENS contract has no deployed code.",
      503,
    );
    const wallet = this.wallets[signer],
      account = wallet.account!;
    // Store the exact signed bytes before broadcast. A crash or RPC timeout can then only
    // rebroadcast this transaction, never mint a duplicate with a fresh nonce.
    const signed = await ensJobCheckpoint(
      "signed." + signer + "." + keccak256(concatHex([to, data])),
      async () => {
        try {
          await this.publicClient.call({ account, to, data });
        } catch (error) {
          const revert =
            error instanceof BaseError
              ? error.walk(
                  (cause) =>
                    cause instanceof ExecutionRevertedError ||
                    cause instanceof ContractFunctionRevertedError,
                )
              : undefined;
          if (
            revert instanceof ExecutionRevertedError ||
            revert instanceof ContractFunctionRevertedError
          )
            throw new ChainRevert(revertReason(revert));
          throw new AppError(
            "ENS_RPC_ERROR",
            "Could not simulate the ENS write. Retry when the RPC is available.",
            503,
            true,
          );
        }
        const request = await wallet.prepareTransactionRequest({
          account,
          chain: sepolia,
          to,
          data,
          value: 0n,
        });
        const serialized = await wallet.signTransaction({ ...request, account, chain: sepolia });
        return { serialized, hash: keccak256(serialized) };
      },
    );
    const hash = signed.hash;
    try {
      await this.publicClient.getTransaction({ hash });
    } catch (error) {
      if (!(error instanceof TransactionNotFoundError))
        throw new AppError(
          "ENS_RPC_ERROR",
          "Could not check the prepared ENS transaction before broadcast.",
          503,
          true,
        );
      try {
        const broadcast = await wallet.sendRawTransaction({
          serializedTransaction: signed.serialized,
        });
        invariant(
          broadcast.toLowerCase() === hash.toLowerCase(),
          "ENS_TX_MISMATCH",
          "The RPC returned a different transaction hash.",
          503,
        );
      } catch (broadcastError) {
        // "Already known" and a timeout after acceptance both recover through the same hash.
        try {
          await this.publicClient.getTransaction({ hash });
        } catch {
          throw broadcastError;
        }
      }
    }
    return { hash, from: account.address.toLowerCase(), to: to.toLowerCase(), calldata: data };
  }
  async registerTrip(input: { city: string; label: string; owner: string; expiry: number }) {
    await this.assertNamespace();
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
    await this.assertNamespace();
    return this.submit(
      "operator",
      this.registryFor(input.city),
      encodeRenew(input.label, input.expiry),
    );
  }
  async unregisterTrip(input: { city: string; label: string }) {
    await this.assertNamespace();
    return this.submit("operator", this.registryFor(input.city), encodeUnregister(input.label));
  }
  async setRecords(signer: Signer, name: string, records: RecordWrite[]) {
    await this.assertNetwork();
    const resolver = await this.publicClient.getEnsResolver({ name });
    // Expiry removes a name from the hierarchy. The operator may still erase that old bundle.
    const clearingExpired =
      signer === "operator" &&
      !resolver &&
      name.endsWith(".tokyo." + parentName()) &&
      records.every((record) =>
        record.type === "text" ? record.value === "" : record.address === "",
      );
    invariant(
      clearingExpired || resolver?.toLowerCase() === this.env.appResolver.toLowerCase(),
      "ENS_RESOLVER_CHANGED",
      "This name no longer uses the configured application resolver.",
      409,
    );
    return this.submit(
      signer,
      this.env.appResolver as Address,
      encodeMulticall(encodeRecordCalls(name, records)),
    );
  }
  async simulateSetText(signer: Signer, name: string, key: string, value: string) {
    await this.assertNetwork();
    try {
      await this.publicClient.simulateContract({
        address: this.env.appResolver as Address,
        abi: resolverAbi,
        functionName: "setText",
        args: [dnsName(name), key, value],
        account: this.wallets[signer].account,
      });
    } catch (error) {
      const revert =
        error instanceof BaseError
          ? error.walk((cause) => cause instanceof ContractFunctionRevertedError)
          : undefined;
      if (revert instanceof ContractFunctionRevertedError)
        throw new ChainRevert(revert.data?.errorName ?? revertReason(revert));
      throw new AppError(
        "ENS_RPC_ERROR",
        "Could not verify resolver permissions. Retry when the RPC is available.",
        503,
        true,
      );
    }
  }
  async readText(name: string, key: string) {
    await this.assertNetwork();
    const value = await this.publicClient.getEnsText({
      name,
      key,
    });
    return value ? value : null;
  }
  async readAddr(name: string, coinType = 60) {
    await this.assertNetwork();
    const value = await this.publicClient.getEnsAddress({
      name,
      coinType: BigInt(coinType),
    });
    return value && value !== ZERO ? value.toLowerCase() : null;
  }
  async tripState(input: { city: string; label: string }): Promise<TripState> {
    await this.assertNamespace();
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
    await this.assertNetwork();
    try {
      const [receipt, tx] = await Promise.all([
        this.publicClient.getTransactionReceipt({ hash: hash as Hash }),
        this.publicClient.getTransaction({ hash: hash as Hash }),
      ]);
      invariant(
        tx.chainId === undefined || tx.chainId === sepolia.id,
        "ENS_CHAIN",
        "The ENS transaction belongs to another chain.",
        409,
      );
      invariant(
        tx.value === 0n,
        "ENS_TX_MISMATCH",
        "The ENS operation included unexpected native value.",
        409,
      );
      const [latest, block] = await Promise.all([
        this.publicClient.getBlockNumber(),
        this.publicClient.getBlock({ blockNumber: receipt.blockNumber }),
      ]);
      if (block.hash !== receipt.blockHash || latest < receipt.blockNumber + 1n)
        return { status: "pending" };
      return {
        status: receipt.status === "success" ? "success" : "reverted",
        from: tx.from.toLowerCase(),
        to: tx.to?.toLowerCase(),
        input: tx.input,
        blockNumber: Number(receipt.blockNumber),
      };
    } catch (error) {
      if (
        error instanceof TransactionReceiptNotFoundError ||
        error instanceof TransactionNotFoundError
      )
        return { status: "pending" };
      if (error instanceof AppError) throw error;
      throw new AppError(
        "ENS_RPC_ERROR",
        "Could not verify the ENS transaction receipt. Retry verification.",
        503,
        true,
      );
    }
  }
  async erc20Transfer(hash: string) {
    await this.assertNetwork();
    let receipt;
    try {
      receipt = await this.publicClient.getTransactionReceipt({ hash: hash as Hash });
    } catch (error) {
      if (error instanceof TransactionReceiptNotFoundError) return null;
      throw new AppError(
        "ENS_RPC_ERROR",
        "Could not verify the split transaction receipt.",
        503,
        true,
      );
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
