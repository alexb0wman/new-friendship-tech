"use client";
import { useEffect, useState } from "react";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { useResource, useSession } from "../session";
import { Arrow, ErrorBox, Eyebrow, Tag, dateLabel } from "../ui";
import { HumanCheck, failureCopy } from "../human-check";
import { useApprovalFlow } from "../approval-modal";
import type { TripDTO } from "@/lib/types";

const day = (offsetDays: number) => {
  const value = new Date(Date.now() + offsetDays * 86400000);
  return value.toISOString().slice(0, 10);
};
const suggest = (name: string) =>
  (name.trim().split(/\s+/)[0] ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32) || "friend";
/**
 * Settings card: your trip is a name. Activation opens World ID; the name shows with its expiry,
 * the Etherscan links, the pay record toggle and the one-time concierge link.
 */
export function TripCard({ city = "tokyo" }: { city?: string }) {
  const { me, api, refresh, notice, config } = useSession();
  const { data, error, loading, reload } = useResource<{ trip: TripDTO | null }>(
    me ? "trips/me?city=" + city : null,
  );
  const trip = data?.trip ?? null;
  const [label, setLabel] = useState(""),
    [arrives, setArrives] = useState(day(0)),
    [departs, setDeparts] = useState(day(3)),
    [checking, setChecking] = useState(false),
    [extendTo, setExtendTo] = useState(""),
    [busy, setBusy] = useState(""),
    [formError, setFormError] = useState<Error | null>(null);
  useEffect(() => {
    if (me && !label) setLabel(suggest(me.user.name));
  }, [me, label]);
  const flow = useApprovalFlow(async (approval) => {
    if (approval.status === "consumed") {
      await refresh();
      notice("The concierge can act for you now. Every action still asks you first.");
    }
  });
  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setFormError(null);
    try {
      await fn();
      await reload();
      await refresh();
    } catch (caught) {
      setFormError(new Error(failureCopy(caught)));
    } finally {
      setBusy("");
    }
  }
  if (!me) return null;
  const parent = config?.ensParent ?? "…";
  return (
    <section id="trip" className="settings-panel trip-card">
      <Eyebrow>YOUR TRIP IS A NAME / ENSv2 SEPOLIA</Eyebrow>
      <h2>{trip ? trip.name : "Activate your Tokyo trip."}</h2>
      <p className="muted">
        A trip is an expiring, non-transferable name under {city}.{parent}. It expires on your
        departure date, and it only exists because World ID confirmed you are one human.
      </p>
      {error && <ErrorBox error={error} retry={reload} />}
      <ErrorBox error={formError} />
      {loading ? (
        <p className="muted small">Loading…</p>
      ) : !trip ? (
        checking ? (
          <HumanCheck
            city={city}
            label={label}
            arrivesAt={new Date(arrives + "T00:00:00+09:00").toISOString()}
            departsAt={new Date(departs + "T23:59:00+09:00").toISOString()}
            onActivated={(created) => {
              setChecking(false);
              void reload();
              void refresh();
              notice(
                created.status === "active"
                  ? created.name + " is live until " + dateLabel(created.departsAt) + "."
                  : created.name + " is registering on Sepolia.",
              );
            }}
            onCancel={(reason) => {
              setChecking(false);
              notice(reason);
            }}
          />
        ) : (
          <form
            className="trip-form"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError(null);
              if (!me.membership.active) {
                setFormError(new Error("All Access is required before a trip name can be minted."));
                return;
              }
              setChecking(true);
            }}
          >
            <label className="field">
              Your label
              <span className="mono-input">
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value.toLowerCase())}
                  minLength={3}
                  maxLength={32}
                  pattern="[a-z0-9][a-z0-9-]{1,30}[a-z0-9]"
                  required
                />
                <span className="muted small">
                  .{city}.{parent}
                </span>
              </span>
            </label>
            <div className="field-pair">
              <label className="field">
                Arrival
                <input
                  type="date"
                  value={arrives}
                  onChange={(event) => setArrives(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                Departure (the name expires)
                <input
                  type="date"
                  value={departs}
                  min={arrives}
                  onChange={(event) => setDeparts(event.target.value)}
                  required
                />
              </label>
            </div>
            <button className="button lime" disabled={!!busy}>
              Activate with World ID <Arrow />
            </button>
            {!me.membership.active && (
              <p className="muted small">All Access is required. Trips are not an entitlement.</p>
            )}
          </form>
        )
      ) : (
        <div className="trip-active">
          <div className="row-between">
            <span className="mono trip-name">{trip.name}</span>
            {trip.verifiedHuman && (
              <Tag lime>
                <BadgeCheck size={12} /> Verified human
              </Tag>
            )}
          </div>
          <div className="trip-meta">
            <span>
              {trip.status === "pending_chain"
                ? "Registering on Sepolia…"
                : "Expires " + dateLabel(trip.departsAt)}
            </span>
            <span className="muted small">
              {trip.status === "active"
                ? "Registered, records written and re-read from chain."
                : trip.status}
            </span>
          </div>
          <div className="link-row">
            {trip.explorer.name && (
              <a
                href={trip.explorer.name}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                View name <ExternalLink size={14} />
              </a>
            )}
            {trip.explorer.tx && (
              <a
                href={trip.explorer.tx}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                Registration tx <ExternalLink size={14} />
              </a>
            )}
            {!trip.explorer.tx && trip.chainTx && (
              <span className="muted small mono">simulated tx {trip.chainTx.slice(0, 10)}…</span>
            )}
          </div>
          {trip.now && (
            <div className="note">
              Right now: {trip.now.kind.toLowerCase()} in {trip.now.area} until{" "}
              {dateLabel(trip.now.until)}.
              {trip.nowOnChain
                ? " Written on your name as friendship.now by the concierge."
                : " Post it through the concierge and it is written on your name as friendship.now."}
            </div>
          )}
          <div className="trip-actions">
            <label className="field">
              Extend to
              <input
                type="date"
                value={extendTo}
                min={trip.departsAt.slice(0, 10)}
                onChange={(event) => setExtendTo(event.target.value)}
              />
            </label>
            <button
              className="button ghost small"
              disabled={!extendTo || !!busy}
              onClick={() =>
                void run("extend", async () => {
                  await api("trips/extend", {
                    method: "POST",
                    body: JSON.stringify({
                      city,
                      departsAt: new Date(extendTo + "T23:59:00+09:00").toISOString(),
                    }),
                  });
                  setExtendTo("");
                  notice("Trip extended. The name renews on chain.");
                })
              }
            >
              Extend
            </button>
            <button
              className="button ghost small"
              disabled={!!busy}
              onClick={() =>
                void run("end", async () => {
                  await api("trips/end", { method: "POST", body: JSON.stringify({ city }) });
                  notice("Trip ended. The name stops resolving.");
                })
              }
            >
              End trip
            </button>
          </div>
          <label className="check-field">
            <input
              type="checkbox"
              checked={!!trip.payAddress}
              disabled={!!busy || trip.status !== "active"}
              onChange={(event) =>
                void run("pay", async () => {
                  await api("trips/pay-record", {
                    method: "POST",
                    body: JSON.stringify({ city, enabled: event.target.checked }),
                  });
                })
              }
            />
            <span>
              <strong>Pay record</strong>
              <small>
                Publish a 0G address record on your name so tables can split the bill to it.
                {trip.payAddress ? " Published: " + trip.payAddress.slice(0, 10) + "…" : ""}
              </small>
            </span>
          </label>
        </div>
      )}
      <div className="concierge-panel">
        <Eyebrow>YOUR CONCIERGE / ONE AGENT, ONE KEY</Eyebrow>
        <p className="mono small">concierge.{parent}</p>
        <p className="muted small">
          May write exactly two records on the app resolver, friendship.now and friendship.table,
          from its own wallet. Anything that puts you in a room with someone waits for your approval
          in World ID.
        </p>
        {me.user.worldAgentLinked ? (
          <Tag lime>
            <BadgeCheck size={12} /> Linked to your World ID
          </Tag>
        ) : (
          <button
            className="button ghost"
            disabled={flow.starting || !config?.world.agentsEnabled}
            onClick={() => void flow.start("world/agent/link")}
          >
            Let the concierge act for you <Arrow />
          </button>
        )}
        {!config?.world.agentsEnabled && (
          <p className="muted small">World ID for Agents is not configured on this deployment.</p>
        )}
      </div>
      {flow.modal}
    </section>
  );
}
