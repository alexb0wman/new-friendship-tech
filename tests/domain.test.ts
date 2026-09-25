import { describe, expect, it, afterEach, vi } from "vitest";
import {
  verifyEvidence,
  type Obligation,
  type SettlementEvidence,
} from "@/server/payments/verification";
import { nextPeriod } from "@/server/membership";
import { sealContact, openContact } from "@/server/privacy";
import { checkoutStatus, paymentAdapter } from "@/server/payments/adapter";
import { isDemo } from "@/server/config";
import { normalize } from "viem/ens";
const obligation: Obligation = {
  chainId: 16661,
  recipient: "0x" + "1".repeat(40),
  asset: "0x" + "2".repeat(40),
  amount: "19000000",
  sourceWallet: "0x" + "3".repeat(40),
  providerQuoteId: "server-quote",
};
const proof: SettlementEvidence = {
  ...obligation,
  txHash: "0x" + "4".repeat(64),
  settlementIndex: "log:3",
  success: true,
  finalized: true,
};
afterEach(() => vi.unstubAllEnvs());
describe("settlement validation", () => {
  it("accepts final, attributed, sufficient settlement and returns a replay key", () => {
    expect(verifyEvidence(obligation, proof).key).toBe("16661:" + proof.txHash + ":log:3");
    expect(verifyEvidence(obligation, { ...proof, amount: "19000001" }).key).toBeTruthy();
  });
  it.each([
    ["success", false, "TX_FAILED"],
    ["finalized", false, "NOT_FINAL"],
    ["chainId", 1, "WRONG_CHAIN"],
    ["recipient", "0xother", "WRONG_RECIPIENT"],
    ["asset", "0xother", "WRONG_ASSET"],
    ["sourceWallet", "0xother", "WRONG_PAYER"],
    ["providerQuoteId", "other", "WRONG_QUOTE"],
    ["amount", "18999999", "UNDERPAID"],
    ["amount", "1.9", "INVALID_AMOUNT"],
    ["txHash", "garbage", "INVALID_TX"],
    ["settlementIndex", "bad/key", "INVALID_EVENT"],
  ])("rejects wrong %s", (field, value, code) => {
    try {
      verifyEvidence(obligation, { ...proof, [field as string]: value });
      throw new Error("accepted invalid proof");
    } catch (error) {
      expect(error).toHaveProperty("code", code);
    }
  });
});
describe("membership and data boundaries", () => {
  it("uses a half-open thirty-day period and preserves paid-through on renewal", () => {
    const now = new Date("2026-09-25T00:00:00Z");
    expect(nextPeriod(now).endsAt.toISOString()).toBe("2026-10-25T00:00:00.000Z");
    expect(nextPeriod(now, new Date("2026-10-25T00:00:00Z")).endsAt.toISOString()).toBe(
      "2026-11-24T00:00:00.000Z",
    );
  });
  it("binds encrypted contacts to their owner and fails on another user", async () => {
    const sealed = await sealContact("a", { type: "Email", value: "private@example.com" });
    expect(JSON.stringify(sealed)).not.toContain("private@example.com");
    expect(await openContact("a", sealed)).toEqual({ type: "Email", value: "private@example.com" });
    await expect(openContact("b", sealed)).rejects.toThrow();
  });
  it("cannot enable mainnet checkout with an environment flag alone", async () => {
    vi.stubEnv("APP_MODE", "production");
    vi.stubEnv("CHECKOUT_ENABLED", "true");
    expect(checkoutStatus().enabled).toBe(false);
    await expect(paymentAdapter().quote("0x" + "1".repeat(40), 1900)).rejects.toHaveProperty(
      "code",
      "PAYMENT_ROUTE_UNVERIFIED",
    );
    expect(() => paymentAdapter("demo")).toThrow();
  });
  it("rejects demo mode in a production process", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => isDemo()).toThrow(/forbidden/);
  });
  it("uses ENSIP normalization rather than custom lowercase-only matching", () => {
    expect(normalize("FRIEND.eth")).toBe("friend.eth");
    expect(() => normalize("bad..eth")).toThrow();
  });
});

import { assertENSWriteProof } from "@/server/ens-proof";
describe("transaction-bound ENS record confirmation", () => {
  const intent = {
    wallet: "0x111",
    resolver: "0x222",
    calldata: "0xabcdef",
    chainId: 11155111,
    description: "Hello Tokyo",
  };
  const tx = { from: "0x111", to: "0x222", input: "0xabcdef", value: 0n };
  it("accepts the exact successful transaction and matching re-read record", () => {
    expect(() =>
      assertENSWriteProof(intent, tx, { status: "success" }, "Hello Tokyo", 11155111),
    ).not.toThrow();
  });
  it.each([{ from: "0x333" }, { to: "0x333" }, { input: "0xdeadbeef" }, { value: 1n }])(
    "rejects altered transaction fields (case %#)",
    (change) => {
      expect(() =>
        assertENSWriteProof(
          intent,
          { ...tx, ...change },
          { status: "success" },
          "Hello Tokyo",
          11155111,
        ),
      ).toThrow();
    },
  );
  it("rejects an unrelated record, failed receipt or wrong chain", () => {
    expect(() =>
      assertENSWriteProof(intent, tx, { status: "success" }, "Unrelated", 11155111),
    ).toThrow();
    expect(() =>
      assertENSWriteProof(intent, tx, { status: "reverted" }, "Hello Tokyo", 11155111),
    ).toThrow();
    expect(() =>
      assertENSWriteProof(intent, tx, { status: "success" }, "Hello Tokyo", 1),
    ).toThrow();
  });
});

import { assertOrigin } from "@/server/http";
describe("Next development origin handling", () => {
  it("uses the loopback Host when Next normalizes Request.url", () => {
    const request = new Request("http://localhost:3092/api/demo/session", {
      method: "POST",
      headers: { host: "127.0.0.1:3092", origin: "http://127.0.0.1:3092" },
    });
    expect(() => assertOrigin(request)).not.toThrow();
    const evil = new Request("http://localhost:3092/api/demo/session", {
      method: "POST",
      headers: { host: "127.0.0.1:3092", origin: "https://evil.example" },
    });
    expect(() => assertOrigin(evil)).toThrow();
  });
});
