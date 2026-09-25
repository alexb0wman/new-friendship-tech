"use client";
import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { encodeFunctionData, erc20Abi, type Address, type EIP1193Provider, type Hex } from "viem";
import { useResource, useSession } from "../session";
import { Loading, AccessState, Avatar, Tag, Arrow, ErrorBox, Eyebrow, dateLabel } from "../ui";
import { useApprovalFlow, approvalErrorCopy } from "../approval-modal";
import { OgPayTrigger } from "../og-pay-trigger";
import { SeatMeter } from "./tables";
import type { GatheringDetail } from "@/lib/types";

const money = (cents: number) => "$" + (cents / 100).toFixed(2);
/** One table: who is at it (names), the host's controls, the split, and the record as written on chain. */
export function TableDetailView({ id, city }: { id: string; city: string }) {
  const { api, me, notice, config, walletProvider } = useSession();
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
              {table.status !== "cancelled" && (
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
                  ogPay={!!config?.splitOgPayEnabled}
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
  ogPay,
  onPaid,
  getProvider,
}: {
  mine: NonNullable<GatheringDetail["split"]["mine"]>;
  tableId: string;
  city: string;
  demo: boolean;
  ogPay: boolean;
  onPaid: () => Promise<void>;
  getProvider: () => Promise<EIP1193Provider>;
}) {
  const { api, notice } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [ogProvider, setOgProvider] = useState<Awaited<ReturnType<typeof getProvider>> | null>(
    null,
  );
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
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
      const [from] = (await provider.request({ method: "eth_accounts" })) as string[];
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [mine.payTo as Address, BigInt(mine.amountBaseUnits)],
      });
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [
          { from: from as Address, to: mine.token as Address, data, chainId: "0xaa36a7" as Hex },
        ],
      });
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
        pay to {mine.payToName} · {mine.payTo.slice(0, 10)}… · {mine.amountBaseUnits} base units of
        USDC
      </p>
      <ErrorBox error={error} />
      {mine.verified ? (
        <Tag lime>
          <BadgeCheck size={12} /> Paid and verified
        </Tag>
      ) : mine.paidTx ? (
        <p className="muted small">Reported {mine.paidTx.slice(0, 12)}…, verifying on chain.</p>
      ) : ogPay && !demo ? (
        ogProvider ? (
          <OgPayTrigger
            provider={ogProvider as unknown as Parameters<typeof OgPayTrigger>[0]["provider"]}
            recipient={mine.payTo}
            outputAmount={(mine.shareCents / 100).toFixed(2)}
            onTransactionHint={(hint) => {
              const candidate =
                hint && typeof hint === "object"
                  ? ((hint as { txHash?: unknown; transactionHash?: unknown }).txHash ??
                    (hint as { transactionHash?: unknown }).transactionHash)
                  : undefined;
              if (typeof candidate === "string" && /^0x[0-9a-fA-F]{64}$/.test(candidate))
                void report(candidate);
              else
                notice("0G Pay returned no transaction hash. Paste it from your wallet history.");
            }}
            onFailure={() => setError(new Error("0G Pay did not complete."))}
          />
        ) : (
          <button
            className="button lime"
            disabled={busy}
            onClick={() => void getProvider().then(setOgProvider)}
          >
            Pay with 0G Pay <Arrow />
          </button>
        )
      ) : (
        <button className="button lime" disabled={busy} onClick={() => void pay()}>
          {busy ? "Paying…" : demo ? "Pay (simulated USDC)" : "Pay in USDC on Sepolia"} <Arrow />
        </button>
      )}
      <Link href={"/" + city + "/tables"} className="text-link muted">
        Back to tables
      </Link>
    </div>
  );
}
