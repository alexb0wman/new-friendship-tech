"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useResource, useSession } from "../session";
import { PageTitle, Eyebrow, Arrow, ErrorBox, Loading, AccessState, dateLabel } from "../ui";
import type { Invoice } from "@/lib/types";
import { OgPayTrigger } from "../og-pay-trigger";
import { formatUnits } from "viem";
export function MembershipView() {
  const { me, ready, config, api, login, notice } = useSession(),
    router = useRouter();
  const { data: history } = useResource<{ items: Invoice[] }>(me ? "invoices" : null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [selectedWallet, setSelectedWallet] = useState("");
  async function purchase() {
    if (!me) return login();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ addresses: string[] }>("me/wallets", { method: "POST" });
      if (!result.addresses.length)
        throw new Error("Connect a funded wallet in your account before paying.");
      const invoice = await api<Invoice>("invoices", {
        method: "POST",
        body: JSON.stringify({
          sourceWallet: result.addresses.includes(selectedWallet)
            ? selectedWallet
            : result.addresses[0],
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      router.push("/checkout/" + invoice.id);
    } catch (value) {
      setError(value instanceof Error ? value : new Error("Could not open checkout."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="A NETWORK THAT TRAVELS WITH YOU"
        title="One membership. All of it."
        description="Every published city. Every member feature. No starting over when you land somewhere new."
      />
      <div className="membership-layout">
        <div className="membership-story">
          <span className="membership-orbit">↗</span>
          <h2>
            Find your people.
            <br />
            Keep your people.
          </h2>
          <p>
            Your saved places, preferences, and connections stay with you. Tokyo is first. New
            cities join your membership as they launch.
          </p>
          <div className="membership-principles">
            <span>01 / No city passes</span>
            <span>02 / No feature tiers</span>
            <span>03 / No auto-renewal</span>
          </div>
        </div>
        <div className="pricing-card">
          <div className="row-between">
            <Eyebrow>ALL ACCESS</Eyebrow>
            <span className="tag lime-tag">
              {me?.membership.active ? "Your membership" : "Founding alpha"}
            </span>
          </div>
          <div className="price">
            $19<span>/ 30 days</span>
          </div>
          <p className="muted">One membership, wherever we go.</p>
          <ul className="benefit-list">
            {[
              "Full published city collections",
              "Recommendations tailored to you",
              "Member discovery and introductions",
              "Right now invitations",
              "Private saved places",
              "New cities included as they launch",
            ].map((item) => (
              <li key={item}>
                <Check size={16} />
                {item}
              </li>
            ))}
          </ul>
          {me?.membership.active && (
            <div className="note">
              <strong>Your All Access is active.</strong>
              <br />
              Paid through {me.membership.paidThrough ? dateLabel(me.membership.paidThrough) : "—"}.
              Renewal adds 30 days after this.
            </div>
          )}
          {!!me?.walletAddresses.length && !config?.demo && (
            <label className="small">
              Paying wallet
              <select
                value={selectedWallet || me.walletAddresses[0]}
                onChange={(event) => setSelectedWallet(event.target.value)}
              >
                {me.walletAddresses.map((address) => (
                  <option key={address} value={address}>
                    {address}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ErrorBox error={error} />
          <button
            className="button lime full"
            disabled={busy || !ready || (!!me && !config?.checkout.enabled)}
            onClick={() => void purchase()}
          >
            {busy
              ? "Opening checkout…"
              : !me
                ? "Sign in to get started"
                : config?.demo
                  ? me.membership.active
                    ? "Simulate renewal"
                    : "Try a demo purchase"
                  : me.membership.active
                    ? "Renew All Access"
                    : "Get All Access"}
            <Arrow />
          </button>
          <p className="small muted">{config?.checkout.reason ?? "Checking availability…"}</p>
          <p className="small muted">
            10 new requests per access period. Meals, drinks, and separately ticketed events cost
            extra.
          </p>
        </div>
      </div>
      <div className="membership-faq">
        <div>
          <h3>What happens if I don't renew?</h3>
          <p>
            You keep your account, saved library, and accepted connections. Renew when you want to
            use paid discovery and start new plans again.
          </p>
        </div>
        <div>
          <h3>Do I pay again in another city?</h3>
          <p>
            No. Every published city is included. We launch with Tokyo, then add cities when their
            collections are ready.
          </p>
        </div>
        <div>
          <h3>Is this a subscription?</h3>
          <p>
            Your membership lasts 30 days. You renew it manually in the alpha. You authorize each
            purchase yourself.
          </p>
        </div>
      </div>
      {!!history?.items.length && (
        <section className="settings-panel">
          <Eyebrow>YOUR PURCHASES</Eyebrow>
          <h2>Membership history</h2>
          <div className="menu-list">
            {history.items.slice(0, 10).map((invoice) => (
              <Link key={invoice.id} href={"/checkout/" + invoice.id}>
                <span>{dateLabel(invoice.createdAt)} · $19</span>
                <span>{invoice.status.replaceAll("_", " ")} ↗</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
export function CheckoutView({ id }: { id: string }) {
  const { data: invoice, error, loading, reload } = useResource<Invoice>("invoices/" + id),
    { api, refresh, walletProvider } = useSession();
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState<Error | null>(null),
    [recoveryHash, setRecoveryHash] = useState("");
  useEffect(() => {
    if (!invoice || !["submitted", "confirming"].includes(invoice.status)) return;
    const timer = setInterval(() => void reload(), 5000);
    return () => clearInterval(timer);
  }, [invoice?.status, reload]);
  async function submitHint(hint: { sourceTx: string }) {
    await api("invoices/" + id + "/submit", { method: "POST", body: JSON.stringify(hint) });
    await reload();
  }
  useEffect(() => {
    if (invoice?.status === "settled") void refresh();
  }, [invoice?.status, refresh]);
  async function recover() {
    setBusy(true);
    setFailure(null);
    try {
      await submitHint({ sourceTx: recoveryHash.trim() });
    } catch (value) {
      setFailure(value instanceof Error ? value : new Error("Could not resume verification."));
    } finally {
      setBusy(false);
    }
  }
  async function simulate() {
    setBusy(true);
    setFailure(null);
    try {
      await api("invoices/" + id + "/simulate", { method: "POST" });
      await reload();
      await refresh();
    } catch (value) {
      setFailure(value instanceof Error ? value : new Error("Could not complete."));
    } finally {
      setBusy(false);
    }
  }
  if (loading && !invoice) return <Loading />;
  if (error) return <AccessState error={error} retry={reload} />;
  if (!invoice) return null;
  const settled = invoice.status === "settled";
  return (
    <div className="checkout-wrap">
      <Link className="back-link" href="/membership">
        ← Membership
      </Link>
      <div className="checkout-card">
        <Eyebrow>{invoice.demo ? "LOCAL DEMO / NO FUNDS MOVE" : "MEMBERSHIP CHECKOUT"}</Eyebrow>
        <h1>{settled ? "You're in." : "Your next 30 days."}</h1>
        <p className="muted">
          {settled
            ? "All Access is active across every published city."
            : "All Access · every published city and member feature."}
        </p>
        <div className="checkout-summary">
          <span>All Access / 30 days</span>
          <strong>$19.00</strong>
        </div>
        <div className="payment-state">
          <span className={"status-dot" + (settled ? "" : " muted-dot")} />
          <span>{invoice.status.replaceAll("_", " ")}</span>
        </div>
        {invoice.demo && (
          <div className="note">
            This local simulation exercises invoices, settlement checks, and membership activation.
            It does not use mainnet or move money.
          </div>
        )}
        {invoice.payment && !settled && (
          <div className="note">
            <strong>
              You pay {formatUnits(BigInt(invoice.payment.sourceAmount), 6)} USDC on Base.
            </strong>
            <p>
              Network gas is additional. 0G Pay routes the payment through TokenFlight. The treasury
              receives at least {formatUnits(BigInt(invoice.payment.minimumOutput), 18)} native 0G
              on 0G mainnet after the quoted route fees. USDC remains the source asset.
            </p>
            <p className="small">
              Treasury: {invoice.payment.recipient}
              <br />
              Paying wallet: {invoice.payment.sourceWallet}
            </p>
          </div>
        )}
        <ErrorBox error={failure} />
        {settled ? (
          <>
            <div className="success-mark">
              <Check size={38} />
            </div>
            <Link href="/tokyo" className="button lime full">
              Make Tokyo yours <Arrow />
            </Link>
            <Link href="/tokyo/people" className="button ghost full">
              Find your people <Arrow />
            </Link>
          </>
        ) : !invoice.demo && invoice.payment && invoice.status === "quoted" ? (
          <OgPayTrigger
            invoiceId={id}
            payment={invoice.payment}
            walletProvider={walletProvider}
            onTransactionHint={submitHint}
            onFailure={setFailure}
          />
        ) : invoice.demo && invoice.status === "quoted" ? (
          <button className="button lime full" disabled={busy} onClick={() => void simulate()}>
            {busy ? "Verifying demo settlement…" : "Complete demo purchase"}
            <Arrow />
          </button>
        ) : (
          <div className="note">
            {invoice.status === "expired"
              ? "This quote expired. If you already sent funds, submit the source transaction below so we can verify the original quote. Do not pay twice."
              : "Your invoice is retained. Refresh this page to check its status. Do not pay again while it is pending."}
          </div>
        )}
        {!invoice.demo && invoice.payment && ["quoted", "expired"].includes(invoice.status) && (
          <details className="note">
            <summary>Already sent the payment?</summary>
            <p>
              Paste the Base deposit transaction from your wallet to resume verification. Use the
              deposit hash, not the USDC approval hash.
            </p>
            <label>
              Base transaction hash
              <input
                value={recoveryHash}
                onChange={(event) => setRecoveryHash(event.target.value)}
                placeholder="0x…"
              />
            </label>
            <button
              className="button ghost full"
              disabled={busy || !/^0x[\da-fA-F]{64}$/.test(recoveryHash.trim())}
              onClick={() => void recover()}
            >
              Resume verification
            </button>
          </details>
        )}
        {invoice.status === "review_required" && (
          <p className="note">
            Your payment needs support review. Keep this invoice and transaction hash. Do not pay
            again until the original payment or refund is resolved.
          </p>
        )}
        <dl className="receipt">
          <div>
            <dt>Invoice</dt>
            <dd>{invoice.id}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>
              {invoice.demo
                ? "Local simulation"
                : invoice.provider === "0g-pay"
                  ? "0G Pay / TokenFlight"
                  : invoice.provider}
            </dd>
          </div>
          <div>
            <dt>Quote expires</dt>
            <dd>{dateLabel(invoice.quoteExpiresAt)}</dd>
          </div>
          {invoice.sourceTx && !invoice.demo && (
            <div>
              <dt>Source transaction</dt>
              <dd>
                <a
                  href={"https://basescan.org/tx/" + invoice.sourceTx}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Base ↗
                </a>
              </dd>
            </div>
          )}
          {invoice.destinationTx && !invoice.demo && (
            <div>
              <dt>Treasury receipt</dt>
              <dd>
                <a
                  href={"https://chainscan.0g.ai/tx/" + invoice.destinationTx}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on 0G ↗
                </a>
              </dd>
            </div>
          )}
          {invoice.settledAt && (
            <div>
              <dt>Settled</dt>
              <dd>{dateLabel(invoice.settledAt)}</dd>
            </div>
          )}
        </dl>
        <p className="small muted">Manual renewal. No recurring debit permission.</p>
      </div>
    </div>
  );
}
