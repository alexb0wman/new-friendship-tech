"use client";
import { useState } from "react";
import { Plus, Bookmark, CalendarDays } from "lucide-react";
import { useResource, useSession } from "../session";
import {
  PageTitle,
  Loading,
  AccessState,
  Empty,
  Modal,
  Avatar,
  Tag,
  TimeLeft,
  Arrow,
  ErrorBox,
} from "../ui";
import { RequestDialog } from "../request-dialog";
import { useCitySelection } from "../city-selection";
import { cityLabel } from "@/lib/city-navigation";
import { ApprovalModal } from "../approval-modal";
import type { ApprovalDTO, TripDTO } from "@/lib/types";
import { INTENTS, NEIGHBORHOODS } from "@/lib/constants";
import type { NowPost, EventItem } from "@/lib/types";
export function NowView({ city }: { city: string }) {
  const { data, error, loading, reload } = useResource<{ items: NowPost[] }>("now?city=" + city),
    { api, notice, me } = useSession();
  const { data: mine } = useResource<{ trip: TripDTO | null }>(me ? "trips/me?city=" + city : null);
  const { cities } = useCitySelection();
  const cityInfo = cities.find((item) => item.slug === city);
  const [approval, setApproval] = useState<ApprovalDTO | null>(null);
  // With an active trip and a linked World ID, the concierge posts it (approved, then written on
  // the trip name). Otherwise the invitation is posted directly, as before.
  const viaConcierge = !!mine?.trip && !!me?.user.worldAgentLinked;
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<NowPost | null>(null),
    [kind, setKind] = useState("Coffee"),
    [area, setArea] = useState(city === "tokyo" ? "Shibuya" : ""),
    [note, setNote] = useState(""),
    [hours, setHours] = useState(2),
    [formError, setFormError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      if (viaConcierge) {
        const proposal = await api<ApprovalDTO>("concierge/now", {
          method: "POST",
          body: JSON.stringify({
            city,
            kind,
            area,
            until: new Date(Date.now() + hours * 3600000).toISOString(),
          }),
        });
        setOpen(false);
        setApproval(proposal);
        return;
      }
      await api("now", {
        method: "POST",
        body: JSON.stringify({ city, kind, neighborhood: area, note, hours }),
      });
      setOpen(false);
      setNote("");
      await reload();
      notice("Your invitation is live.");
    } catch (error) {
      setFormError(error instanceof Error ? error : new Error("Could not post."));
    } finally {
      setBusy(false);
    }
  }
  async function cancel(id: string) {
    try {
      await api("now/" + id, { method: "DELETE" });
      await reload();
    } catch (error) {
      notice(error instanceof Error ? error.message : "Could not remove.");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="A LITTLE SPONTANEITY GOES A LONG WAY"
        title="Now."
        description="Coffee. A walk. A work session. Put a simple plan out there."
        action={
          <button className="button lime" onClick={() => setOpen(true)}>
            <Plus size={18} />
            Make a plan
          </button>
        }
      />
      <div className="now-intro">
        <span className="status-dot" />
        <p>Invitations are temporary. Good connections don't have to be.</p>
        <span className="eyebrow">{cityInfo?.name ?? cityLabel(city)}</span>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <AccessState error={error} retry={reload} />
      ) : data?.items.length ? (
        <div className="now-grid">
          {data.items.map((post) => (
            <article className="now-card" key={post.id}>
              <div className="row-between">
                <Tag lime>{post.kind}</Tag>
                <TimeLeft expiresAt={post.expiresAt} />
              </div>
              <h2>{post.neighborhood}?</h2>
              <p className="now-note">{post.note}</p>
              <div className="now-owner">
                <Avatar name={post.owner.name} />
                <div>
                  <strong>{post.owner.name}</strong>
                  <span>{post.owner.role}</span>
                </div>
              </div>
              <div className="row-between">
                <span className="fixture-label">
                  {post.owner.fixture ? "Demo invitation" : "Open to a connection"}
                </span>
                {post.own ? (
                  <button className="text-link" onClick={() => void cancel(post.id)}>
                    End invitation
                  </button>
                ) : (
                  <button className="text-link" onClick={() => setSelected(post)}>
                    Request to join <Arrow />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Be the first to make a plan."
          action={
            <button className="button lime" onClick={() => setOpen(true)}>
              Put it out there <Arrow />
            </button>
          }
        >
          A good invitation can be as simple as “Coffee?”
        </Empty>
      )}
      <Modal open={open} title="What's the plan?" onClose={() => setOpen(false)}>
        <form onSubmit={submit}>
          <div className="filter-chips">
            {INTENTS.map((item) => (
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
            {city === "tokyo" ? (
              <select value={area} onChange={(event) => setArea(event.target.value)}>
                {NEIGHBORHOODS.slice(1).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            ) : (
              <input
                value={area}
                onChange={(event) => setArea(event.target.value)}
                required
                minLength={1}
                maxLength={60}
                placeholder="Where would you like to meet?"
              />
            )}
          </label>
          <label className="field">
            A short invitation
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              required
              minLength={5}
              maxLength={140}
              placeholder="Coffee after the conference?"
            />
          </label>
          <label className="field">
            Keep this open for
            <select value={hours} onChange={(event) => setHours(Number(event.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <option value={value} key={value}>
                  {value} {value === 1 ? "hour" : "hours"}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small">
            This replaces your previous active invitation. Your profile must be discoverable.
            {viaConcierge
              ? " The concierge posts it after your World ID approval and writes it on your trip name."
              : ""}
          </p>
          <ErrorBox error={formError} />
          <button disabled={busy} className="button lime full">
            {busy
              ? "Publishing…"
              : viaConcierge
                ? "Ask the concierge to post it"
                : "Make it happen"}
            <Arrow />
          </button>
        </form>
      </Modal>
      <ApprovalModal
        approval={approval}
        onClose={() => setApproval(null)}
        onResolved={(resolved) => {
          if (resolved.status === "consumed") {
            setNote("");
            void reload();
            notice("Posted by the concierge and written on your trip name.");
          }
        }}
      />
      <RequestDialog
        key={selected?.id ?? "none"}
        member={selected?.owner ?? null}
        nowPostId={selected?.id}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
export function EventsView({ city }: { city: string }) {
  const { data, error, loading, reload } = useResource<{ items: EventItem[] }>(
      "events?city=" + city,
    ),
    { api, me, login, notice } = useSession();
  const { cities } = useCitySelection();
  const cityInfo = cities.find((item) => item.slug === city);
  const timeZone = cityInfo?.timezone ?? "UTC";
  async function save(event: EventItem) {
    if (!me) return login();
    try {
      await api("saves", {
        method: "POST",
        body: JSON.stringify({ type: "event", id: event.id, saved: !event.saved }),
      });
      await reload();
    } catch (error) {
      notice(error instanceof Error ? error.message : "Could not save.");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="THE RIGHT ROOM CHANGES EVERYTHING"
        title="Where to be."
        description="Things worth leaving the house for. Registration stays with the organizer."
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <AccessState error={error} retry={reload} />
      ) : data?.items.length ? (
        <div className="events-list">
          {data.items.map((event) => (
            <article className="event-row" key={event.id}>
              <div className="event-date">
                <span>
                  {new Intl.DateTimeFormat("en", { month: "short", timeZone }).format(
                    new Date(event.startsAt),
                  )}
                </span>
                <strong>
                  {new Intl.DateTimeFormat("en", { day: "2-digit", timeZone }).format(
                    new Date(event.startsAt),
                  )}
                </strong>
              </div>
              <div className="event-main">
                <div className="eyebrow">
                  {event.neighborhood} /{" "}
                  {event.fixture ? "SAMPLE EVENT" : (cityInfo?.name ?? cityLabel(city))}
                </div>
                <h2>{event.title}</h2>
                <p>
                  {new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone,
                  }).format(new Date(event.startsAt))}{" "}
                  · {timeZone}
                </p>
                <p className="muted small">{event.accessNote}</p>
              </div>
              <div className="event-actions">
                <button
                  className="icon-button"
                  aria-label={event.saved ? "Unsave event" : "Save event"}
                  onClick={() => void save(event)}
                >
                  <Bookmark size={18} fill={event.saved ? "currentColor" : "none"} />
                </button>
                {event.fixture ? (
                  <span className="tag">Demo only</span>
                ) : (
                  <a
                    href={event.registrationUrl}
                    className="button ghost"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View registration <Arrow />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="The next good room is coming.">
          No verified upcoming events are published yet. Check back soon.
        </Empty>
      )}
      <p className="disclaimer">
        Saving an event is a bookmark, not an RSVP. Membership does not guarantee admission.
      </p>
    </>
  );
}
