import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionNotFoundError, TransactionReceiptNotFoundError, keccak256 } from "viem";
import { eq } from "drizzle-orm";
import { getDb, closeDb } from "@/server/db";
import * as s from "@/server/db/schema";
import { applyWrite } from "@/server/db/write";
import {
  enqueueEnsJob,
  ensJobSubmission,
  registerEnsJobHandler,
  runEnsWorkerOnce,
} from "@/server/ens-v2/jobs";
import { ensNetwork, ensRpcUrl } from "@/server/ens-network";
import { ensWorldEnv, explorerName, explorerTx, type EnsWorldEnv } from "@/server/ens-v2/addresses";
import { SepoliaChain } from "@/server/ens-v2/sepolia";
import { resolveENS } from "@/server/ens";
import { assertENSWriteProof } from "@/server/ens-proof";
import { assertChainWriteProof } from "@/server/ens-v2/proof";

const rpc = vi.hoisted(() => ({
  getChainId: vi.fn(),
  getEnsResolver: vi.fn(),
  getEnsAddress: vi.fn(),
  getEnsText: vi.fn(),
  getCode: vi.fn(),
  readContract: vi.fn(),
  call: vi.fn(),
  getTransactionReceipt: vi.fn(),
  getTransaction: vi.fn(),
  getBlockNumber: vi.fn(),
  getBlock: vi.fn(),
}));
const send = vi.hoisted(() => vi.fn());
const sign = vi.hoisted(() => vi.fn());
const prepare = vi.hoisted(() => vi.fn());
vi.mock("viem", async (original) => ({
  ...(await original<typeof import("viem")>()),
  createPublicClient: vi.fn(() => rpc),
  createWalletClient: vi.fn(({ account }) => ({
    account,
    sendRawTransaction: send,
    signTransaction: sign,
    prepareTransactionRequest: prepare,
  })),
}));
const addr = (n: number) => "0x" + n.toString(16).padStart(40, "0");
const hash = "0x" + "a".repeat(64);
const env: EnsWorldEnv = {
  rpcUrl: "https://rpc.example",
  parentRegistry: addr(10),
  cityRegistryTokyo: addr(11),
  appResolver: addr(12),
  operatorKey: ("0x" + "1".padStart(64, "0")) as `0x${string}`,
  conciergeKey: ("0x" + "2".padStart(64, "0")) as `0x${string}`,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ENS_ENABLED", "true");
  vi.stubEnv("ENS_PARENT_NAME", "friendship.eth");
  vi.stubEnv("ENS_MAINNET_RPC_URL", "https://rpc.example");
  vi.stubEnv("ENS_CHAIN_ID", "1");
  rpc.getChainId.mockResolvedValue(11155111);
  rpc.getEnsResolver.mockResolvedValue(env.appResolver);
  rpc.getCode.mockResolvedValue("0x1234");
  rpc.call.mockResolvedValue({ data: "0x" });
  send.mockResolvedValue(hash);
  sign.mockResolvedValue("0x0102");
  prepare.mockResolvedValue({});
});

describe("durable ENS broadcast", () => {
  beforeAll(async () => {
    await getDb();
  });
  afterAll(closeDb);
  it("persists signed bytes before broadcast and recovers acceptance after a dropped RPC response", async () => {
    const c = new SepoliaChain(env);
    const signedHash = keccak256("0x0102");
    rpc.getTransaction.mockRejectedValue(new TransactionNotFoundError({ hash: signedHash }));
    send.mockRejectedValue(new Error("RPC response dropped after acceptance"));
    registerEnsJobHandler("record.set", async () => {
      const tx = await ensJobSubmission("records.transaction", () =>
        c.setRecords("operator", "maya.tokyo.friendship.eth", [
          { type: "text", key: "description", value: "Tokyo" },
        ]),
      );
      return { txHash: tx.hash };
    });
    const id = await applyWrite(null, "test.ens.broadcast", "test", (tx) =>
      enqueueEnsJob(tx, { kind: "record.set", signer: "operator", entityId: "test" }),
    );
    await runEnsWorkerOnce();
    const db = await getDb();
    const [pending] = await db.select().from(s.ensJobs).where(eq(s.ensJobs.id, id));
    expect(pending.status).toBe("ready");
    expect(Object.values(pending.payload.checkpoints as Record<string, unknown>)).toContainEqual({
      serialized: "0x0102",
      hash: signedHash,
    });
    // The first transaction is now visible; no new signature, nonce, simulation or broadcast is needed.
    rpc.getTransaction.mockResolvedValue({ hash: signedHash });
    rpc.call.mockRejectedValue(new Error("would now revert if replayed"));
    await db
      .update(s.ensJobs)
      .set({ runAfter: new Date(0) })
      .where(eq(s.ensJobs.id, id));
    await runEnsWorkerOnce();
    const [done] = await db.select().from(s.ensJobs).where(eq(s.ensJobs.id, id));
    expect(done.status).toBe("done");
    expect(done.txHash).toBe(signedHash);
    expect(sign).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(rpc.call).toHaveBeenCalledTimes(1);
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("live ENS network boundaries", () => {
  it("defaults account identity to Ethereum and keeps namespace transactions on Sepolia", async () => {
    expect(ensNetwork().id).toBe(1);
    rpc.getChainId.mockResolvedValue(1);
    rpc.getEnsAddress.mockResolvedValue(addr(30));
    rpc.getEnsText.mockResolvedValue("Hello");
    expect(await resolveENS("FRIEND.eth")).toMatchObject({
      name: "friend.eth",
      chainId: 1,
      address: addr(30),
    });
    await expect(
      new SepoliaChain(env).setRecords("operator", "friend.friendship.eth", []),
    ).rejects.toHaveProperty("code", "ENS_CHAIN");
    expect(send).not.toHaveBeenCalled();
  });
  it("rejects unsupported chains and a missing or invalid RPC URL", () => {
    expect(() => ensNetwork(16661)).toThrow();
    vi.stubEnv("ENS_MAINNET_RPC_URL", "file:///tmp/rpc");
    expect(ensRpcUrl()).toBeNull();
    vi.stubEnv("ENS_MAINNET_RPC_URL", "");
    expect(ensRpcUrl()).toBeNull();
  });
  it("refuses to write into a resolver the name no longer uses", async () => {
    rpc.getEnsResolver.mockResolvedValue(addr(99));
    await expect(
      new SepoliaChain(env).setRecords("operator", "maya.tokyo.friendship.eth", [
        { type: "text", key: "description", value: "x" },
      ]),
    ).rejects.toHaveProperty("code", "ENS_RESOLVER_CHANGED");
    expect(send).not.toHaveBeenCalled();
  });
  it("refuses an address without contract code before sending a transaction", async () => {
    rpc.getCode.mockResolvedValue("0x");
    await expect(
      new SepoliaChain(env).setRecords("operator", "maya.tokyo.friendship.eth", [
        { type: "text", key: "description", value: "x" },
      ]),
    ).rejects.toHaveProperty("code", "ENS_CONTRACT_MISSING");
    expect(send).not.toHaveBeenCalled();
  });
  it("keeps a pre-broadcast RPC outage retryable without signing or sending", async () => {
    rpc.call.mockRejectedValue(new Error("RPC gateway timeout"));
    await expect(
      new SepoliaChain(env).setRecords("operator", "maya.tokyo.friendship.eth", [
        { type: "text", key: "description", value: "x" },
      ]),
    ).rejects.toMatchObject({ code: "ENS_RPC_ERROR", retryable: true });
    expect(sign).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  it("checks the hierarchy before registering a trip", async () => {
    rpc.readContract.mockResolvedValue(addr(99));
    await expect(
      new SepoliaChain(env).registerTrip({
        city: "tokyo",
        label: "maya",
        owner: addr(30),
        expiry: 2000000000,
      }),
    ).rejects.toHaveProperty("code", "ENS_NAMESPACE_CHANGED");
    expect(send).not.toHaveBeenCalled();
  });
  it("distinguishes pending receipts from a broken RPC", async () => {
    rpc.getTransactionReceipt.mockRejectedValue(
      new TransactionReceiptNotFoundError({ hash: hash as `0x${string}` }),
    );
    expect(await new SepoliaChain(env).receipt(hash)).toEqual({ status: "pending" });
    rpc.getTransactionReceipt.mockRejectedValue(new Error("connection refused"));
    await expect(new SepoliaChain(env).receipt(hash)).rejects.toHaveProperty(
      "code",
      "ENS_RPC_ERROR",
    );
  });
  it("requires a canonical block and two confirmations", async () => {
    rpc.getTransactionReceipt.mockResolvedValue({
      status: "success",
      blockNumber: 100n,
      blockHash: hash,
    });
    rpc.getTransaction.mockResolvedValue({
      from: addr(1),
      to: env.appResolver,
      input: "0x1234",
      value: 0n,
      chainId: 11155111,
    });
    rpc.getBlockNumber.mockResolvedValue(100n);
    rpc.getBlock.mockResolvedValue({ hash });
    expect(await new SepoliaChain(env).receipt(hash)).toEqual({ status: "pending" });
    rpc.getBlockNumber.mockResolvedValue(101n);
    expect(await new SepoliaChain(env).receipt(hash)).toMatchObject({ status: "success" });
    rpc.getBlock.mockResolvedValue({ hash: "0xreorg" });
    expect(await new SepoliaChain(env).receipt(hash)).toEqual({ status: "pending" });
  });
});

describe("ENS proof integrity", () => {
  it("does not treat differently cased text records as equal", () => {
    const submission = { hash, from: addr(1), to: addr(2), calldata: "0xab" };
    expect(() =>
      assertChainWriteProof({
        submission,
        receipt: { status: "success", from: addr(1), to: addr(2), input: "0xab" },
        expected: { records: [{ type: "text", key: "description", value: "Alice" }] },
        observed: { "text:description": "alice" },
      }),
    ).toThrow(expect.objectContaining({ code: "ENS_RECORD_MISMATCH" }));
  });
  it("rejects transaction chain disagreement even when the RPC chain matches", () => {
    const intent = {
      wallet: addr(1),
      resolver: addr(2),
      calldata: "0xab",
      chainId: 1,
      description: "x",
    };
    expect(() =>
      assertENSWriteProof(
        intent,
        { from: addr(1), to: addr(2), input: "0xab", value: 0n, chainId: 11155111 },
        { status: "success" },
        "x",
        1,
      ),
    ).toThrow(expect.objectContaining({ code: "ENS_CHAIN" }));
  });
  it("does not expose public chain links for simulated records", () => {
    expect(explorerName("fake.eth")).toBeNull();
    expect(explorerTx(hash)).toBeNull();
  });
  it("rejects a namespace using the operator as the concierge", () => {
    for (const [key, value] of Object.entries({
      ENS_SEPOLIA_RPC_URL: env.rpcUrl,
      ENS_PARENT_REGISTRY: env.parentRegistry,
      ENS_CITY_REGISTRY_TOKYO: env.cityRegistryTokyo,
      ENS_APP_RESOLVER: env.appResolver,
      ENS_OPERATOR_PRIVATE_KEY: env.operatorKey,
      ENS_CONCIERGE_PRIVATE_KEY: env.operatorKey,
    }))
      vi.stubEnv(key, value);
    expect(ensWorldEnv()).toBeNull();
  });
});
