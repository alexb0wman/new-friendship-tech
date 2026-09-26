import { afterEach, describe, expect, it, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  type Hex,
  type PublicClient,
} from "viem";
import {
  SPLIT_NETWORKS,
  splitCalldata,
  splitNetwork,
  verifySplitTransfer,
  type SplitObligation,
} from "@/server/splits/settlement";

const payer = "0x1111111111111111111111111111111111111111";
const recipient = "0x2222222222222222222222222222222222222222";
const hash = ("0x" + "1".repeat(64)) as Hex;
const blockHash = ("0x" + "2".repeat(64)) as Hex;
const obligation: SplitObligation = {
  chainId: 8453,
  token: SPLIT_NETWORKS.base.token,
  payer,
  recipient,
  amount: 19_000_000n,
  minBlock: 100n,
};
function fixture() {
  const transaction = {
    hash,
    from: payer,
    to: obligation.token,
    input: splitCalldata(obligation),
    value: 0n,
    blockHash,
    blockNumber: 101n,
    chainId: 8453,
  };
  const receipt = {
    transactionHash: hash,
    from: payer,
    to: obligation.token,
    status: "success",
    blockHash,
    blockNumber: 101n,
    logs: [
      {
        address: obligation.token,
        topics: encodeEventTopics({
          abi: erc20Abi,
          eventName: "Transfer",
          args: { from: payer, to: recipient },
        }),
        data: encodeAbiParameters([{ type: "uint256" }], [obligation.amount]),
        removed: false,
      },
    ],
  };
  const rpc = {
    getChainId: vi.fn().mockResolvedValue(8453),
    getTransaction: vi.fn().mockResolvedValue(transaction),
    getTransactionReceipt: vi.fn().mockResolvedValue(receipt),
    getBlock: vi.fn().mockResolvedValue({ hash: blockHash, number: 120n }),
  };
  return { transaction, receipt, rpc, client: rpc as unknown as PublicClient };
}
afterEach(() => vi.unstubAllEnvs());
describe("independent mainnet USDC split verification", () => {
  it("defaults live splits to Base and keeps explicit Ethereum independent of ENS", () => {
    vi.stubEnv("APP_MODE", "production");
    vi.stubEnv("ENS_NETWORK", "sepolia");
    expect(splitNetwork().chainId).toBe(8453);
    vi.stubEnv("SPLIT_NETWORK", "ethereum");
    expect(splitNetwork().chainId).toBe(1);
    expect(() => splitNetwork(0)).toThrow(/local only/);
  });
  it("accepts only a canonical finalized direct native USDC transfer", async () => {
    const f = fixture();
    await expect(verifySplitTransfer(obligation, hash, f.client)).resolves.toEqual({
      settlementKey: "8453:" + hash,
      txHash: hash,
      blockNumber: "101",
    });
  });
  it.each([
    "chain",
    "token",
    "payer",
    "recipient",
    "amount",
    "native",
    "old",
    "revert",
    "log",
    "duplicate",
  ])("rejects wrong %s evidence", async (kind) => {
    const f = fixture();
    if (kind === "chain") f.rpc.getChainId.mockResolvedValue(1);
    if (kind === "token") f.transaction.to = recipient;
    if (kind === "payer") f.transaction.from = recipient;
    if (kind === "recipient")
      f.transaction.input = splitCalldata({ recipient: payer, amount: obligation.amount });
    if (kind === "amount")
      f.transaction.input = splitCalldata({ recipient, amount: obligation.amount - 1n });
    if (kind === "native") f.transaction.value = 1n;
    if (kind === "old") f.receipt.blockNumber = 99n;
    if (kind === "revert") f.receipt.status = "reverted";
    if (kind === "log") f.receipt.logs[0].data = encodeAbiParameters([{ type: "uint256" }], [1n]);
    if (kind === "duplicate") f.receipt.logs.push(f.receipt.logs[0]);
    await expect(verifySplitTransfer(obligation, hash, f.client)).rejects.toThrow();
  });
  it("holds unfinalized and reorganized receipts for retry", async () => {
    const f = fixture();
    f.rpc.getBlock.mockResolvedValue({ hash: blockHash, number: 100n });
    await expect(verifySplitTransfer(obligation, hash, f.client)).rejects.toMatchObject({
      code: "PENDING",
      retryable: true,
    });
    f.rpc.getBlock.mockResolvedValue({ hash, number: 120n });
    await expect(verifySplitTransfer(obligation, hash, f.client)).rejects.toMatchObject({
      code: "PENDING",
      retryable: true,
    });
  });
  it("holds missing RPC evidence instead of trusting the hint", async () => {
    const f = fixture();
    f.rpc.getTransactionReceipt.mockRejectedValue(new Error("not found"));
    await expect(verifySplitTransfer(obligation, hash, f.client)).rejects.toMatchObject({
      code: "PENDING",
      retryable: true,
    });
  });
});
