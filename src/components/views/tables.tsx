"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, BadgeCheck, ExternalLink } from "lucide-react";
import { useResource, useSession } from "../session";
import {
  PageTitle,
  Loading,
  AccessState,
  Empty,
  Modal,
  Avatar,
  Tag,
  Arrow,
  ErrorBox,
  dateLabel,
} from "../ui";
import { useApprovalFlow } from "../approval-modal";
import { NEIGHBORHOODS } from "@/lib/constants";
import type { GatheringSummary, Place, TripDTO } from "@/lib/types";

export const TABLE_KINDS = ["coffee", "breakfast", "lunch", "dinner", "drinks"] as const;
export function SeatMeter({ seats, seatsLeft }: { seats: number; seatsLeft: number }) {
  return (
    <span className="seat-meter" aria-label={seatsLeft + " of " + seats + " seats left"}>
      {Array.from({ length: seats }, (_, index) => (
        <i key={index} className={index < seats - seatsLeft ? "taken" : ""} />
      ))}
    </span>
  );
}
export function TableCard({
  table,
  onJoin,
  busy,
}: {
  table: GatheringSummary;
  onJoin: (plusOnes: number) => void;
  busy: boolean;
}) {
  const [plusOne, setPlusOne] = useState(false);
  const where = table.place ? table.place.name : table.area;
  return (
    <article className="table-card">
      <div className="row-between">
        <Tag lime>{table.kind}</Tag>
        <span className="muted small">
          {table.seatsLeft} of {table.seats} seats left
        </span>
      </div>
      <h2>
        {where}, {dateLabel(table.startsAt)}
      </h2>
      <SeatMeter seats={table.seats} seatsLeft={table.seatsLeft} />
      <div className="table-host">
        <Avatar name={table.host.displayName} />
        <div>
          <strong>
            {table.host.displayName}{" "}
            {table.host.verifiedHuman && (
              <span className="badge-inline">
                <BadgeCheck size={13} /> Verified human
              </span>
            )}
          </strong>
          <span className="mono">{table.host.name}</span>
        </div>
      </div>
      <span className="table-name mono">{table.name}</span>
      <div className="link-row">
        {table.explorer.name && (
          <a
            className="text-link"
            href={table.explorer.name}
            target="_blank"
            rel="noopener noreferrer"
          >
            On-chain record <ExternalLink size={13} />
          </a>
        )}
        {table.explorer.tx && (
          <a
            className="text-link"
            href={table.explorer.tx}
            target="_blank"
            rel="noopener noreferrer"
          >
            Last write <ExternalLink size={13} />
          </a>
        )}
        {!table.explorer.tx && table.chainRecordTx && (
          <span className="muted small mono">record tx {table.chainRecordTx.slice(0, 10)}…</span>
        )}
      </div>
      <div className="row-between">
        {table.mine ? (
          <Link className="text-link" href={"/" + table.city + "/tables/" + table.id}>
            Manage your table <Arrow />
          </Link>
        ) : table.myStatus === "approved" ? (
          <Link className="text-link" href={"/" + table.city + "/tables/" + table.id}>
            You're in <Arrow />
          </Link>
        ) : table.myStatus === "requested" ? (
          <span className="muted small">Requested, waiting for the host</span>
        ) : table.status !== "open" || table.seatsLeft === 0 ? (
          <span className="muted small">{table.status === "open" ? "Full" : table.status}</span>
        ) : (
          <>
            <label className="check-field inline">
              <input
                type="checkbox"
                checked={plusOne}
                disabled={table.seatsLeft < 2}
                onChange={(event) => setPlusOne(event.target.checked)}
              />
              <span>Bring a plus-one</span>
            </label>
            <button className="text-link" disabled={busy} onClick={() => onJoin(plusOne ? 1 : 0)}>
              Ask to join <Arrow />
            </button>
          </>
        )}
      </div>
    </article>
  );
}
function defaultStart() {
  const value = new Date(Date.now() + 3 * 3600000);
  value.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    value.getFullYear() +
    "-" +
    pad(value.getMonth() + 1) +
    "-" +
    pad(value.getDate()) +
    "T" +
    pad(value.getHours()) +
    ":" +
    pad(value.getMinutes())
  );
}
/** Small meals with verified humans: coffee, breakfast, lunch, dinner, drinks. Each table is a name. */
export function TablesView({ city }: { city: string }) {
  const { api, me, notice } = useSession();
  const { data, error, loading, reload } = useResource<{ items: GatheringSummary[] }>(
    "gatherings?city=" + city,
  );
  const { data: mine } = useResource<{ trip: TripDTO | null }>(me ? "trips/me?city=" + city : null);
  const { data: places } = useResource<{ items: Place[] }>(me ? "places?city=" + city : null);
  const [open, setOpen] = useState(false),
    [kind, setKind] = useState<(typeof TABLE_KINDS)[number]>("dinner"),
    [area, setArea] = useState("Shibuya"),
    [placeId, setPlaceId] = useState(""),
    [startsAt, setStartsAt] = useState(defaultStart()),
    [seats, setSeats] = useState(4),
    [formError, setFormError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false);
  const flow = useApprovalFlow(async (approval) => {
    if (approval.status === "consumed") {
      await reload();
      notice("Your request landed. The host approves it with their own World ID step-up.");
    }
  });
  async function host(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const created = await api<GatheringSummary>("gatherings", {
        method: "POST",
        body: JSON.stringify({
          city,
          kind,
          area,
          placeId: placeId || undefined,
          startsAt: new Date(startsAt).toISOString(),
          seats,
        }),
      });
      setOpen(false);
      await reload();
      notice(created.name + " is live. The concierge wrote its record from its own wallet.");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught : new Error("Could not host."));
    } finally {
      setBusy(false);
    }
  }
  const trip = mine?.trip ?? null;
  return (
    <>
      <PageTitle
        eyebrow="THE DINNER TABLE AS A TEMPORARY NAME"
        title="Dine."
        description="Small meals with verified humans. Every table is a name; every seat is approved."
        action={
          <button className="button lime" onClick={() => setOpen(true)} disabled={!trip}>
            <Plus size={18} />
            Host a table
          </button>
        }
      />
      {me && !trip && !loading && (
        <div className="note">
          Activate your trip in <Link href="/settings">Settings</Link> to host or join a table.
          Tables are for members who are here, now, and verified.
        </div>
      )}
      {loading ? (
        <Loading />
      ) : error ? (
        <AccessState error={error} retry={reload} />
      ) : data?.items.length ? (
        <div className="table-grid">
          {data.items.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              busy={flow.starting}
              onJoin={(plusOnes) =>
                void flow.start("gatherings/" + table.id + "/request", { plusOnes })
              }
            />
          ))}
        </div>
      ) : (
        <Empty
          title="No tables yet tonight."
          action={
            <button className="button lime" onClick={() => setOpen(true)} disabled={!trip}>
              Host the first one <Arrow />
            </button>
          }
        >
          A table can be as small as coffee for two.
        </Empty>
      )}
      <Modal open={open} title="Host a table" onClose={() => setOpen(false)}>
        <form onSubmit={host}>
          <div className="filter-chips">
            {TABLE_KINDS.map((item) => (
              <button
                type="button"
                key={item}
                className={"chip" + (kind === item ? " selected" : "")}
                onClick={() => setKind(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="field">
            Neighborhood
            <select value={area} onChange={(event) => setArea(event.target.value)}>
              {NEIGHBORHOODS.slice(1).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Place (optional)
            <select value={placeId} onChange={(event) => setPlaceId(event.target.value)}>
              <option value="">Somewhere in {area}</option>
              {places?.items
                .filter((place) => place.neighborhood === area)
                .map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="field-pair">
            <label className="field">
              When
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
              />
            </label>
            <label className="field">
              Seats, you included
              <select value={seats} onChange={(event) => setSeats(Number(event.target.value))}>
                {[2, 3, 4, 5, 6, 7, 8].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted small">
            The table gets a data-only name under tables.{city}. Its attendee record is written by
            the concierge, names only.
          </p>
          <ErrorBox error={formError} />
          <button disabled={busy} className="button lime full">
            {busy ? "Writing the record…" : "Open the table"}
            <Arrow />
          </button>
        </form>
      </Modal>
      {flow.modal}
    </>
  );
}
