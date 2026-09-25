"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ApiError, useSession } from "./session";
import { Arrow, ErrorBox } from "./ui";
import type { TripDTO } from "@/lib/types";

const IdkitWidget = dynamic(() => import("./idkit-widget"), { ssr: false });
interface RpContextDTO {
  rp_id: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
  app_id: string;
  action: string;
  environment: string;
}
export interface HumanCheckProps {
  city: string;
  label: string;
  arrivesAt: string;
  departsAt: string;
  onActivated: (trip: TripDTO) => void;
  onCancel: (reason: string) => void;
}
const FAILURE_COPY: Record<string, string> = {
  WORLD_CREDENTIAL_UNAVAILABLE:
    "This World ID has no Proof of Human credential yet. Try the passport path, or come back after an Orb visit.",
  WORLD_VERIFY_FAILED: "World ID could not verify that proof. No trip was created.",
  WORLD_SIGNAL_MISMATCH: "That proof was made for a different city. No trip was created.",
  HUMAN_ALREADY_PRESENT:
    "This World ID already has an active trip in this city. One human, one trip: end the other trip first.",
  TRIP_EXISTS: "You already have an active trip here.",
  MEMBERSHIP_REQUIRED: "All Access is required before a trip name can be minted.",
};
export function failureCopy(error: unknown) {
  if (error instanceof ApiError) return FAILURE_COPY[error.code] ?? error.message;
  return error instanceof Error ? error.message : "Something went wrong.";
}
/**
 * The trust moment: activating a trip makes a member publicly present in a city and lets them host
 * or join tables with strangers. The minimum sufficient assurance is that they are one human, so the
 * widget asks for Proof of Human (passport as the Orb-free alternative). The demo swaps the widget for
 * a simulated panel that exercises the same backend paths, including the failure paths.
 */
export function HumanCheck(props: HumanCheckProps) {
  const { config } = useSession();
  if (!config) return null;
  if (config.world.simulated) return <SimulatedHumanPanel {...props} />;
  if (!config.world.enabled)
    return (
      <div className="note">
        World ID is not configured on this deployment. Set WORLD_APP_ID, WORLD_RP_ID and the RP
        signing key to activate trips.
      </div>
    );
  return <LiveHumanCheck {...props} />;
}
function activationBody(props: HumanCheckProps, proof: unknown) {
  return {
    city: props.city,
    label: props.label || undefined,
    arrivesAt: props.arrivesAt,
    departsAt: props.departsAt,
    proof,
  };
}
function SimulatedHumanPanel(props: HumanCheckProps) {
  const { api, me } = useSession();
  // Demo account ids share a prefix, so the suffix is what tells accounts apart.
  const [human, setHuman] = useState("human-" + (me?.user.id.slice(-6) ?? "demo"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  async function verify(unavailable = false) {
    setBusy(true);
    setError(null);
    try {
      const trip = await api<TripDTO>("world/verify", {
        method: "POST",
        body: JSON.stringify(
          activationBody(props, {
            simulated: true,
            human,
            ...(unavailable ? { unavailable } : {}),
          }),
        ),
      });
      props.onActivated(trip);
    } catch (caught) {
      setError(new Error(failureCopy(caught)));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="sim-panel" role="group" aria-label="Simulated World ID">
      <p className="eyebrow">SIMULATED WORLD ID · LOCAL DEMO</p>
      <p className="muted small">
        In production this is the World ID widget asking for Proof of Human. Here, the identity
        below stands in for a World ID: the same string on two accounts is the same human, and the
        backend rejects the second trip.
      </p>
      <label className="field">
        World ID identity
        <input value={human} onChange={(event) => setHuman(event.target.value)} maxLength={80} />
      </label>
      <ErrorBox error={error} />
      <div className="button-row">
        <button
          className="button lime"
          disabled={busy || !human.trim()}
          onClick={() => void verify()}
        >
          {busy ? "Verifying…" : "Verify as this human"} <Arrow />
        </button>
        <button className="button ghost" disabled={busy} onClick={() => void verify(true)}>
          Credential unavailable
        </button>
        <button
          className="button ghost"
          disabled={busy}
          onClick={() => props.onCancel("You closed World ID. No trip was created.")}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
function LiveHumanCheck(props: HumanCheckProps) {
  const { api, config } = useSession();
  const [rp, setRp] = useState<RpContextDTO | null>(null);
  const [credential, setCredential] = useState<"human" | "passport">("human");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<RpContextDTO>("world/rp-context?action=" + encodeURIComponent(config?.world.action ?? ""))
      .then((value) => {
        if (!cancelled) setRp(value);
      })
      .catch((caught) => {
        if (!cancelled) setError(new Error(failureCopy(caught)));
      });
    return () => {
      cancelled = true;
    };
  }, [api, config?.world.action]);
  if (!config) return null;
  const environment = (
    ["production", "staging", "sandbox"].includes(config.world.environment)
      ? config.world.environment
      : "staging"
  ) as "production" | "staging" | "sandbox";
  return (
    <div className="sim-panel" role="group" aria-label="World ID">
      <p className="muted small">
        World ID asks for Proof of Human: one person, one trip. Nothing about who you are is shared.
      </p>
      <ErrorBox error={error} />
      <div className="button-row">
        <button
          className="button lime"
          disabled={!rp}
          onClick={() => {
            setCredential("human");
            setOpen(true);
          }}
        >
          Verify with World ID <Arrow />
        </button>
        <button
          className="button ghost"
          disabled={!rp}
          onClick={() => {
            setCredential("passport");
            setOpen(true);
          }}
        >
          Use passport instead
        </button>
        <button className="button ghost" onClick={() => props.onCancel("No trip was created.")}>
          Cancel
        </button>
      </div>
      {rp && (
        <IdkitWidget
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setError(null);
          }}
          appId={rp.app_id}
          action={rp.action}
          rpContext={{
            rp_id: rp.rp_id,
            nonce: rp.nonce,
            created_at: rp.created_at,
            expires_at: rp.expires_at,
            signature: rp.signature,
          }}
          environment={environment}
          credential={credential}
          signal={props.city}
          onVerify={async (result) => {
            try {
              const trip = await api<TripDTO>("world/verify", {
                method: "POST",
                body: JSON.stringify(activationBody(props, result)),
              });
              props.onActivated(trip);
            } catch (caught) {
              setError(new Error(failureCopy(caught)));
              throw caught;
            }
          }}
          onError={(code) => {
            if (code !== "failed_by_host_app")
              props.onCancel(
                code === "user_rejected" || code === "cancelled"
                  ? "You closed World ID. No trip was created."
                  : "World ID reported " + code + ". No trip was created.",
              );
          }}
        />
      )}
    </div>
  );
}
