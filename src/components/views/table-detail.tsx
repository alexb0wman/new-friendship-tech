"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { numberToHex, type Address, type Hex, type EIP1193Provider } from "viem";
import { useResource, useSession } from "../session";
import { Loading, AccessState, Avatar, Tag, Arrow, ErrorBox, Eyebrow, dateLabel } from "../ui";
import { useApprovalFlow, approvalErrorCopy } from "../approval-modal";
import { SeatMeter } from "./tables";
import type { GatheringDetail } from "@/lib/types";

const money = (cents: number) => "$" + (cents / 100).toFixed(2);
/** One table: who is at it (names), the host's controls, the split, and the record as written on chain. */
export function TableDetailView({ id, city }: { id: string; city: string }) {
  const { api, notice, config, walletProvider } = useSession();
  const { data, error, loading, reload } = useResource<GatheringDetail>("gatherings/" + id);
  const [total, setTotal] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState<Error | null>(null);
  const [provider, setProvider] = useState<EIP1193Provider | null>(null);
  const flow = useApprovalFlow(async (approval) => {
    if (approval.status === "consumed") {
      await reload();
      notice("Approved. The attendee record on the table name was rewritten by the concierge.");
    }
  });
  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (caught) {
      setActionError(new Error(approvalErrorCopy(caught)));
    } finally {
      setBusy("");
    }
  }
  if (loading) return <Loading />;
  if (error) return <AccessState error={error} retry={reload} />;
  if (!data) return null;
  const table = data,
    mine = table.split.mine,
    isHost = table.mine;
  const where = table.place ? table.place.name : table.area;
  return (
    <>
      <Link href={"/" + city + "/tables"} className="back-link">
        ← Back to tables
      </Link>
      <div className="page-title">
        <div>
          <Eyebrow>
            {table.kind.toUpperCase()} / {table.status.toUpperCase()}
          </Eyebrow>
          <h1>
            {where}, {dateLabel(table.startsAt)}
          </h1>
          <p className="muted mono small">{table.name}</p>
        </div>
        <SeatMeter seats={table.seats} seatsLeft={table.seatsLeft} />
      </div>
      <ErrorBox error={actionError} />
      <div className="detail-grid">
        <section className="settings-panel">
          <Eyebrow>AT THE TABLE / NAMES ONLY</Eyebrow>
          <div className="attendee-list">
            {table.attendees.map((attendee) => (
              <div className="attendee-row" key={attendee.id}>
                <div className="table-host">
                  <Avatar name={attendee.displayName} />
                  <div className="who">
                    <strong>
                      {attendee.displayName}
                      {attendee.role === "host" ? " · host" : ""}
                      {attendee.plusOnes ? " · +" + attendee.plusOnes : ""}
                    </strong>
                    <small className="mono">{attendee.name}</small>
                  </div>
                </div>
                <div className="button-row">
                  {attendee.verifiedHuman && (
                    <Tag lime>
                      <BadgeCheck size={12} /> Verified human
                    </Tag>
                  )}
                  <Tag>{attendee.status}</Tag>
                  {isHost && attendee.status === "requested" && (
                    <>
                      <button
                        className="button lime small"
                        disabled={flow.starting || !!busy}
                        onClick={() =>
                          void flow.start("gatherings/" + table.id + "/approve", {
                            attendeeId: attendee.id,
                          })
                        }
                      >
                        Approve <Arrow />
                      </button>
                      <button
                        className="button ghost small"
                        disabled={!!busy}
                        onClick={() =>
                          void act("decline", async () => {
                            await api("gatherings/" + table.id + "/decline", {
                              method: "POST",
                              body: JSON.stringify({ attendeeId: attendee.id }),
                            });
                          })
                        }
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {attendee.status === "approved" &&
                    attendee.role === "member" &&
                    attendee.shareCents != null && (
                      <span className="muted small">
                        {money(attendee.shareCents)}{" "}
                        {attendee.paidVerifiedAt
                          ? "· paid"
                          : attendee.paidTx
                            ? "· verifying"
                            : "· due"}
                      </span>
                    )}
                </div>
              </div>
            ))}
          </div>
          {table.guests > 0 && (
            <p className="muted small">
              {table.guests} plus-one{table.guests > 1 ? "s" : ""} at the table. Plus-ones have no
              name, so their share is on the host.
            </p>
          )}
          {isHost ? (
            <div className="button-row">
              {table.status !== "closed" && table.status !== "cancelled" && (
                <button
                  className="button ghost small"
                  disabled={!!busy}
                  onClick={() =>
                    void act("close", async () => {
                      await api("gatherings/" + table.id + "/close", {
                        method: "POST",
                        body: "{}",
                      });
                    })
                  }
                >
                  Close the table
                </button>
              )}
              {table.status !== "cancelled" && table.split.status === "none" && (
                <button
                  className="button ghost small"
                  disabled={!!busy}
                  onClick={() =>
                    void act("cancel", async () => {
                      await api("gatherings/" + table.id + "/cancel", {
                        method: "POST",
                        body: "{}",
                      });
                    })
                  }
                >
                  Cancel
                </button>
              )}
            </div>
          ) : (
            table.split.status === "none" &&
            (table.myStatus === "approved" || table.myStatus === "requested") && (
              <button
                className="button ghost small"
                disabled={!!busy}
                onClick={() =>
                  void act("leave", async () => {
                    await api("gatherings/" + table.id + "/leave", { method: "POST", body: "{}" });
                  })
                }
              >
                Leave the table
              </button>
            )
          )}
          {!isHost && table.myStatus === null && table.status === "open" && table.seatsLeft > 0 && (
            <button
              className="button lime"
              disabled={flow.starting}
              onClick={() =>
                void flow.start("gatherings/" + table.id + "/request", { plusOnes: 0 })
              }
            >
              Ask to join <Arrow />
            </button>
          )}
        </section>
        <section className="settings-panel split-panel">
          <Eyebrow>SPLIT THE BILL / RESOLVED FROM NAMES</Eyebrow>
          {table.split.status === "none" ? (
            isHost ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void act("split", async () => {
                    await api("gatherings/" + table.id + "/split", {
                      method: "POST",
                      body: JSON.stringify({ totalCents: Math.round(Number(total) * 100) }),
                    });
                    setTotal("");
                  });
                }}
              >
                <label className="field">
                  Total in USD
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={total}
                    onChange={(event) => setTotal(event.target.value)}
                    placeholder="120.00"
                    required
                  />
                </label>
                <p className="muted small">
                  Equal shares across everyone at the table. Each member pays your address, resolved
                  fresh from {table.host.name}. Plus-ones and rounding land on you.
                </p>
                <button className="button lime" disabled={!!busy || !total}>
                  Split the bill <Arrow />
                </button>
              </form>
            ) : (
              <p className="muted small">The host has not split the bill yet.</p>
            )
          ) : (
            <>
              <p>
                {money(table.split.totalCents ?? 0)} total · {money(table.split.unitCents ?? 0)} per
                person · host covers {money(table.split.hostCents ?? 0)}
              </p>
              {table.split.status === "settled" ? (
                <div className="approval-result consumed">
                  <BadgeCheck size={22} />
                  <div>
                    <strong>Settled.</strong>
                    <p className="muted small">Every share was verified on chain.</p>
                  </div>
                </div>
              ) : mine ? (
                <PaySection
                  mine={mine}
                  tableId={table.id}
                  city={city}
                  demo={!!config?.demo}
                  onPaid={reload}
                  getProvider={async () => {
                    const next = provider ?? (await walletProvider());
                    setProvider(next);
                    return next;
                  }}
                />
              ) : (
                <p className="muted small">
                  Waiting for members to pay. Hints are verified from the chain.
                </p>
              )}
            </>
          )}
        </section>
      </div>
      <section className="settings-panel">
        <Eyebrow>THE RECORD ON CHAIN / friendship.table</Eyebrow>
        <div className="link-row">
          {table.explorer.name && (
            <a
              className="text-link"
              href={table.explorer.name}
              target="_blank"
              rel="noopener noreferrer"
            >
              {table.name} <ExternalLink size={13} />
            </a>
          )}
          {table.explorer.tx && (
            <a
              className="text-link"
              href={table.explorer.tx}
              target="_blank"
              rel="noopener noreferrer"
            >
              Last write by the concierge <ExternalLink size={13} />
            </a>
          )}
          {!table.explorer.tx && table.chainRecordTx && (
            <span className="muted small mono">
              simulated write {table.chainRecordTx.slice(0, 12)}…
            </span>
          )}
        </div>
        <pre className="record-box">
          {table.record ?? "(no record: the table was cancelled or the record was cleared)"}
        </pre>
        <p className="muted small">
          Written by concierge.{config?.ensParent ?? "…"} with its own wallet. It holds the setter
          role for this one key; a write to any other key reverts.
        </p>
      </section>
      {flow.modal}
    </>
  );
}
function PaySection({
  mine,
  tableId,
  city,
  demo,
  onPaid,
  getProvider,
}: {
  mine: NonNullable<GatheringDetail["split"]["mine"]>;
  tableId: string;
  city: string;
  demo: boolean;
  onPaid: () => Promise<void>;
  getProvider: () => Promise<EIP1193Provider>;
}) {
  const { api, notice, me } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [recoveryHash, setRecoveryHash] = useState("");
  const [sentHash, setSentHash] = useState("");
  const recoveryKey = "split-payment:" + tableId + ":" + (me?.user.id ?? "");
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(recoveryKey);
      if (stored && /^0x[0-9a-fA-F]{64}$/.test(stored)) {
        setSentHash(stored);
        setRecoveryHash(stored);
      }
    } catch {
      /* Wallet history also provides transaction recovery. */
    }
  }, [recoveryKey]);
  async function report(txHash: string) {
    await api("gatherings/" + tableId + "/split/paid", {
      method: "POST",
      body: JSON.stringify({ txHash }),
    });
    await onPaid();
    notice(
      "Payment reported. The worker verifies recipient, amount and finality before it counts.",
    );
  }
  async function pay() {
    setBusy(true);
    setError(null);
    try {
      if (demo) {
        await api("gatherings/" + tableId + "/split/simulate", { method: "POST", body: "{}" });
        await onPaid();
        notice("Simulated USDC transfer verified. Your share is settled.");
        return;
      }
      const provider = await getProvider();
      if (mine.chainId == null || mine.chainId === 0)
        throw new Error("This split requires review before mainnet payment.");
      const [from] = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      if (!from) throw new Error("Select your linked wallet first.");
      const prepared = await api<{
        chainId: number;
        from: Address;
        to: Address;
        data: Hex;
        value: Hex;
      }>("gatherings/" + tableId + "/split/prepare", {
        method: "POST",
        body: JSON.stringify({ payer: from }),
      });
      const chainId = numberToHex(prepared.chainId);
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
      const activeChain = await provider.request({ method: "eth_chainId" });
      if (BigInt(String(activeChain)) !== BigInt(prepared.chainId))
        throw new Error("Wallet is on the wrong network.");
      const [selected] = (await provider.request({ method: "eth_accounts" })) as string[];
      if (selected?.toLowerCase() !== prepared.from.toLowerCase())
        throw new Error("Wallet changed. Select the wallet prepared for this share.");
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: prepared.from,
            to: prepared.to,
            data: prepared.data,
            value: prepared.value,
            chainId,
          },
        ],
      });
      setRecoveryHash(String(hash));
      setSentHash(String(hash));
      try {
        sessionStorage.setItem(recoveryKey, String(hash));
      } catch {
        /* Retain in component state. */
      }
      await report(String(hash));
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("Payment did not go through."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="split-panel">
      <p>
        Your share: <strong>{money(mine.shareCents)}</strong>
      </p>
      <p className="muted small mono">
        Pay {mine.payToName} · {mine.payTo} · USDC on {mine.chainName}
      </p>
      {!demo && (
        <p className="muted small">
          Your wallet signs a direct USDC transfer. You need USDC and ETH for network fees on{" "}
          {mine.chainName}. Settlement waits for a finalized block.
        </p>
      )}
      <ErrorBox error={error} />
      {mine.verified ? (
        <Tag lime>
          <BadgeCheck size={12} /> Paid and verified
        </Tag>
      ) : mine.paidTx || sentHash ? (
        <div>
          <p className="muted small">
            {mine.errorCode && mine.errorCode !== "PENDING"
              ? "This transfer has not satisfied your share. Check its network, recipient, amount, and paying wallet before reporting another transaction."
              : "Transfer " +
                (mine.paidTx ?? sentHash).slice(0, 12) +
                "… is awaiting verification. Do not pay again."}
          </p>
          <button
            className="button ghost small"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void report(mine.paidTx ?? sentHash)
                .catch((caught) =>
                  setError(
                    caught instanceof Error ? caught : new Error("Could not refresh payment."),
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            Check settlement
          </button>
        </div>
      ) : (
        <>
          <button
            className="button lime"
            disabled={busy || mine.chainId == null}
            onClick={() => void pay()}
          >
            {busy ? "Paying…" : demo ? "Pay (simulated USDC)" : "Pay USDC on " + mine.chainName}{" "}
            <Arrow />
          </button>
        </>
      )}
      {mine.explorerTx && (
        <a className="text-link" href={mine.explorerTx} target="_blank" rel="noopener noreferrer">
          View payment <ExternalLink size={13} />
        </a>
      )}
      {!mine.verified && !demo && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setError(null);
            void report(recoveryHash)
              .catch((caught) =>
                setError(caught instanceof Error ? caught : new Error("Could not report payment.")),
              )
              .finally(() => setBusy(false));
          }}
        >
          <label className="field">
            Already sent this payment? Recover with its transaction hash.
            <input
              className="mono"
              value={recoveryHash}
              onChange={(event) => setRecoveryHash(event.target.value)}
              placeholder="0x…"
              pattern="0x[0-9a-fA-F]{64}"
              required
            />
          </label>
          <button className="button ghost small" disabled={busy || !recoveryHash}>
            Verify existing transfer
          </button>
        </form>
      )}
      <Link href={"/" + city + "/tables"} className="text-link muted">
        Back to tables
      </Link>
    </div>
  );
}
