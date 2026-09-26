"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useResource, useSession } from "../session";
import { useCitySelection } from "../city-selection";
import { cityLabel } from "@/lib/city-navigation";
import { AccessState, Avatar, Empty, Loading, PageTitle } from "../ui";
import type { ConnectionItem, EventItem, Place, PublicMember } from "@/lib/types";

const TOPICS = [
  "All",
  "Crypto",
  "Bitcoin",
  "Ethereum",
  "AI",
  "Fintech",
  "Regulation",
  "Venture",
  "Tokyo",
];

function useDirectory(resources: readonly ("members" | "events" | "places" | "requests")[]) {
  const members = useResource<{ items: PublicMember[] }>(
    resources.includes("members") ? "members?limit=50" : null,
  );
  const selection = useCitySelection();
  const { city, citySlug } = selection;
  const cities = {
    data: { items: selection.cities },
    loading: selection.loading,
    error: selection.error,
    reload: selection.reload,
  };
  const events = useResource<{ items: EventItem[] }>(
    resources.includes("events") && citySlug ? "events?city=" + citySlug : null,
  );
  const places = useResource<{ items: Place[] }>(
    resources.includes("places") && citySlug ? "places?city=" + citySlug : null,
  );
  const requests = useResource<{ items: ConnectionItem[] }>(
    resources.includes("requests") ? "requests" : null,
  );
  return { members, cities, events, places, requests, city };
}

function RegisterRow({ index, member }: { index: number; member: PublicMember }) {
  return (
    <Link className="register-row" href={"/members/" + member.id}>
      <span className="register-index">{String(index).padStart(2, "0")}</span>
      <Avatar name={member.name} />
      <div>
        <strong>{member.name}</strong>
        <p className="muted small">{member.role}</p>
      </div>
      <span className="chip">{cityLabel(member.city)}</span>
      <span className="muted small">
        {member.ensName ? "ENS linked" : member.host ? "Host" : "Self-described"}
      </span>
    </Link>
  );
}

export function NetworkView() {
  const { me } = useSession();
  const { members, cities, events, places, city } = useDirectory(["members", "events", "places"]);
  const [query, setQuery] = useState("");
  const items = members.data?.items ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 6);
    return items.filter((member) =>
      [member.name, member.role, member.bio, member.city, ...member.interests, ...member.intents]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, query]);
  const unsupported = query.trim().length > 0 && !/[a-z]/i.test(query);
  return (
    <div className="stack">
      <PageTitle
        eyebrow="Members"
        title="Connect."
        description="Members who have chosen to be listed."
      />
      {!me?.user.onboarded && (
        <div className="note">
          Personalize Connect. A few choices tune places, people, and Now.{" "}
          <Link href="/onboarding">Start</Link>
        </div>
      )}
      <form
        className="ask-row"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label htmlFor="ask">Ask the Network</label>
        <input
          id="ask"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={"AI founders" + (city ? " in " + city.name : "")}
        />
      </form>
      {unsupported && (
        <p className="muted">That query is not supported yet. Try a role, city, or interest.</p>
      )}
      {members.loading ? (
        <Loading />
      ) : (
        <AccessState error={members.error} retry={() => void members.reload()} />
      )}
      <div className="register">
        {filtered.map((member, index) => (
          <RegisterRow key={member.id} index={index + 1} member={member} />
        ))}
        {!members.loading && filtered.length === 0 && (
          <Empty title="No matching members.">
            Try a role, city, or interest. Unsupported questions stay unanswered.
          </Empty>
        )}
      </div>
      <div className="stat-row">
        <div>
          <strong>{items.length}</strong>
          <span>Discoverable members</span>
        </div>
        <div>
          <strong>{cities.data?.items.filter((city) => city.published).length ?? 0}</strong>
          <span>Published cities</span>
        </div>
        <div>
          <strong>{places.data?.items.length ?? 0}</strong>
          <span>{city?.name ?? "City"} places in view</span>
        </div>
        <div>
          <strong>{events.data?.items.length ?? 0}</strong>
          <span>Listed events</span>
        </div>
      </div>
      <p className="muted small">
        Counts come from the app database. They are not the brand's event attendance or newsletter
        size.
      </p>
    </div>
  );
}

export function AtlasView() {
  const { me } = useSession();
  const { members, requests } = useDirectory(["members", "requests"]);
  const items = members.data?.items ?? [];
  const accepted = (requests.data?.items ?? []).filter((item) => item.status === "accepted");
  const [fromId, setFromId] = useState(me?.user.id ?? "");
  const [toId, setToId] = useState(items[0]?.id ?? "");
  const from = fromId === me?.user.id ? me?.user : items.find((member) => member.id === fromId);
  const to = items.find((member) => member.id === toId);
  const direct = accepted.find((item) => item.member.id === toId || item.member.id === fromId);
  let path = "No permissible path. Private relationships are not inferred from public profiles.";
  if (fromId && toId && fromId === toId) path = "Choose two different people.";
  else if (me && (fromId === me.user.id || toId === me.user.id) && direct)
    path = `You and ${direct.member.name} already have an accepted connection.`;
  else if (from && to)
    path = "No recorded introduction connects these two people in a way you are allowed to see.";
  return (
    <div className="stack">
      <PageTitle
        eyebrow="Connections"
        title="Atlas."
        description="Paths between members, built from accepted connections."
      />
      <div className="ask-row">
        <label htmlFor="from">From</label>
        <select id="from" value={fromId} onChange={(event) => setFromId(event.target.value)}>
          {me && <option value={me.user.id}>You</option>}
          {items.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <label htmlFor="to">To</label>
        <select id="to" value={toId} onChange={(event) => setToId(event.target.value)}>
          {items.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>
      <div className="note">{path}</div>
      <div className="register">
        {items.map((member, index) => (
          <RegisterRow key={member.id} index={index + 1} member={member} />
        ))}
      </div>
    </div>
  );
}

export function DirectoryView({ kind }: { kind: "companies" | "capital" }) {
  const { members } = useDirectory(["members"]);
  const items = (members.data?.items ?? []).filter((member) =>
    kind === "capital" ? /invest|angel|fund|capital/i.test(member.role + member.bio) : true,
  );
  return (
    <div className="stack">
      <PageTitle
        eyebrow={kind === "capital" ? "Capital" : "Companies"}
        title={kind === "capital" ? "Capital." : "Companies."}
        description="Self-described until reviewed. Payment does not verify an employer or a fund."
      />
      {members.loading ? <Loading /> : null}
      {items.length === 0 ? (
        <Empty title="Nothing reviewed yet.">
          Members can propose an affiliation. Pending claims stay distinct from published companies.
        </Empty>
      ) : (
        <div className="register">
          {items.map((member, index) => (
            <RegisterRow key={member.id} index={index + 1} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CitiesView() {
  const { cities, members } = useDirectory(["members"]);
  const items = cities.data?.items ?? [];
  return (
    <div className="stack">
      <PageTitle eyebrow="Cities" title="Cities." description="Every published city." />
      {cities.loading ? (
        <Loading />
      ) : cities.error ? (
        <AccessState error={cities.error} retry={cities.reload} />
      ) : !items.length ? (
        <Empty title="No cities are published yet.">Please check back soon.</Empty>
      ) : null}
      <div className="city-grid">
        {items.map((city, index) => (
          <Link
            key={city.slug}
            className="city-card"
            href={city.published ? "/" + city.slug : "/cities"}
          >
            <span className="eyebrow">
              {String(index + 1).padStart(2, "0")} · {city.published ? "Live" : "Upcoming"}
            </span>
            <h2>{city.name}</h2>
            <p className="muted">
              {(members.data?.items ?? []).filter((member) => member.city === city.slug).length}{" "}
              discoverable members
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function EditorialView({ kind }: { kind: "intelligence" | "read" }) {
  const [topic, setTopic] = useState("All");
  return (
    <div className="stack">
      <PageTitle
        eyebrow={kind === "intelligence" ? "Intelligence" : "Read"}
        title={kind === "intelligence" ? "Intelligence." : "Read."}
        description="Editorial from the network. Every piece links to its source."
      />
      <div className="chip-row">
        {TOPICS.map((item) => (
          <button
            key={item}
            className={item === topic ? "chip selected" : "chip"}
            onClick={() => setTopic(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      <Empty title="No reviewed stories yet.">
        {topic === "All"
          ? "The editorial desk is empty until an operator publishes a sourced dispatch."
          : `No reviewed ${topic} stories.`}
      </Empty>
    </div>
  );
}

export function WhereView() {
  const { events, city } = useDirectory(["events"]);
  const items = events.data?.items ?? [];
  return (
    <div className="stack">
      <PageTitle
        eyebrow={city?.name ?? "Where to be"}
        title="Where to be."
        description="Published events in your selected city. Saving an event is not a ticket."
      />
      {events.loading ? <Loading /> : null}
      {events.error ? (
        <AccessState error={events.error} retry={events.reload} />
      ) : !events.loading && items.length === 0 ? (
        <Empty title="No published events yet.">Check back for new listings.</Empty>
      ) : (
        <div className="register">
          {items.map((event) => (
            <a
              key={event.id}
              className="register-row"
              href={event.registrationUrl}
              target="_blank"
              rel="noreferrer"
            >
              <div>
                <strong>{event.title}</strong>
                <p className="muted small">
                  {event.neighborhood} · {event.accessNote}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function StandingsView() {
  const { me } = useSession();
  const { requests } = useDirectory(["requests"]);
  const accepted = (requests.data?.items ?? []).filter((item) => item.status === "accepted");
  return (
    <div className="stack">
      <PageTitle
        eyebrow="Standings"
        title="Standings."
        description="Accepted connections on record."
      />
      <div className="stat-row">
        <div>
          <strong>{me ? accepted.length : "—"}</strong>
          <span>Accepted connections you can see</span>
        </div>
      </div>
      <Empty title="No public ranking yet.">
        Scores appear only from recorded introductions, referrals, and confirmed attendance. None
        are published.
      </Empty>
    </div>
  );
}

export function TrustView() {
  return (
    <div className="stack">
      <PageTitle eyebrow="Trust" title="Trust." description="What each verification label means." />
      <div className="register">
        <div className="register-row">
          <strong>Wallet linked</strong>
          <p className="muted">The account controls a verified wallet.</p>
        </div>
        <div className="register-row">
          <strong>ENS linked</strong>
          <p className="muted">A name currently resolves to that wallet. ENSv2 runs on Sepolia.</p>
        </div>
        <div className="register-row">
          <strong>Host</strong>
          <p className="muted">An operator assigned this role.</p>
        </div>
        <div className="register-row">
          <strong>Self-described</strong>
          <p className="muted">A title the member wrote. It is not a reviewed claim.</p>
        </div>
      </div>
      <Link className="button" href="/settings">
        Review your identity
      </Link>
    </div>
  );
}

export function InviteTreeView() {
  return (
    <div className="stack">
      <PageTitle eyebrow="Invite tree" title="Invite Tree." description="Who referred whom." />
      <Empty title="No invitation lineage yet.">
        Referral links will appear here after the first attributed signup.
      </Empty>
      <Link className="button" href="/onboarding">
        Join without an invitation
      </Link>
    </div>
  );
}

export function IntroductionsView() {
  return (
    <div className="stack">
      <PageTitle
        eyebrow="Intros"
        title="Intros."
        description="Connection requests and introductions."
      />
      <Link className="button" href="/requests">
        Open your requests
      </Link>
      <div className="note">
        Warm introductions are the next workflow on this same request service. They are not a second
        inbox.
      </div>
    </div>
  );
}

export function PolicyView() {
  return (
    <div className="stack policy-page">
      <PageTitle eyebrow="Member policy" title="Member policy." />
      <p>
        Profiles are private until you opt in. Contact details are shared only after both people
        accept. You can block or report. Blocking hides profiles, invitations, and shared contacts
        in both directions.
      </p>
      <p className="muted">
        Seller, support, retention, and refund terms still need the operator before real payments
        open.
      </p>
      <p>
        <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
      </p>
    </div>
  );
}

export function OperationsView() {
  const { me } = useSession();
  if (!me?.user.admin) {
    return <Empty title="Restricted.">Operators only.</Empty>;
  }
  return (
    <div className="stack">
      <PageTitle
        eyebrow="Operations"
        title="Operations."
        description="Place edits, reports, and invoices. No mark-as-paid switch."
      />
      <Link className="button" href="/admin">
        Open the admin console
      </Link>
    </div>
  );
}
