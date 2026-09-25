"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useResource, useSession } from "../session";
import { PageTitle, Eyebrow, Arrow, ErrorBox, Loading, AccessState, dateLabel } from "../ui";
import type { Invoice } from "@/lib/types";
export function MembershipView() {
  const { me, ready, config, api, login, notice } = useSession(),
    router = useRouter();
  const { data: history } = useResource<{ items: Invoice[] }>(me ? "invoices" : null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null);
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
          sourceWallet: result.addresses[0],
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
    { api, refresh, notice } = useSession();
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState<Error | null>(null);
  useEffect(() => {
    if (!invoice || !["submitted", "confirming"].includes(invoice.status)) return;
    const timer = setInterval(() => void reload(), 5000);
    return () => clearInterval(timer);
  }, [invoice?.status, reload]);
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
        ) : invoice.demo && invoice.status === "quoted" ? (
          <button className="button lime full" disabled={busy} onClick={() => void simulate()}>
            {busy ? "Verifying demo settlement…" : "Complete demo purchase"}
            <Arrow />
          </button>
        ) : (
          <div className="note">
            {invoice.status === "expired"
              ? "This quote expired. Return to membership to create a new one."
              : "Your invoice is retained. Refresh this page to check its status. Do not pay again while it is pending."}
          </div>
        )}
        <dl className="receipt">
          <div>
            <dt>Invoice</dt>
            <dd>{invoice.id}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{invoice.demo ? "Local simulation" : invoice.provider}</dd>
          </div>
          <div>
            <dt>Quote expires</dt>
            <dd>{dateLabel(invoice.quoteExpiresAt)}</dd>
          </div>
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
