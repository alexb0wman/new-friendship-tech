"use client";
import Link from "next/link";
import { useState } from "react";
import { Search, BadgeCheck } from "lucide-react";
import { useResource, useSession } from "../session";
import { PageTitle, Loading, AccessState, Empty, Avatar, Tag, Arrow, ErrorBox, Modal } from "../ui";
import { RequestDialog } from "../request-dialog";
import type { PublicMember, ConnectionItem } from "@/lib/types";

export function MemberCard({ member, onConnect }: { member: PublicMember; onConnect: () => void }) {
  return (
    <article className="member-card">
      <div className="row-between">
        <Avatar name={member.name} large />
        {member.host ? (
          <Tag lime>Community host</Tag>
        ) : (
          <span className="fixture-label">{member.fixture ? "Demo member" : member.city}</span>
        )}
      </div>
      <Link href={"/members/" + member.id}>
        <h3>{member.name}</h3>
      </Link>
      <p className="member-role">{member.role}</p>
      <p className="member-bio">{member.bio}</p>
      {member.ensName && <span className="ens-label">{member.ensName} · Sepolia</span>}
      <div className="tags">
        {member.interests.slice(0, 3).map((interest) => (
          <Tag key={interest}>{interest}</Tag>
        ))}
      </div>
      <div className="member-bottom">
        <span>{member.neighborhood}</span>
        <button onClick={onConnect} className="text-link">
          Connect <Arrow />
        </button>
      </div>
    </article>
  );
}
export function PeopleView({ city }: { city: string }) {
  const { api, notice } = useSession(),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<PublicMember | null>(null),
    [ensName, setEnsName] = useState(""),
    [ensBusy, setEnsBusy] = useState(false);
  const { data, error, loading, reload } = useResource<{ items: PublicMember[] }>(
    "members?" + new URLSearchParams({ city, q: query }),
  );
  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setEnsBusy(true);
    try {
      const result = await api<{ member: PublicMember }>(
        "ens/lookup?name=" + encodeURIComponent(ensName),
      );
      setSelected(result.member);
    } catch (error) {
      notice(error instanceof Error ? error.message : "Could not resolve name.");
    } finally {
      setEnsBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="GOOD PEOPLE. GOOD TIMING."
        title="Find your people."
        description="A shared interest can be all it takes. Profiles appear here by choice."
      />
      <div className="people-toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A name, an interest, a role…"
            aria-label="Search members"
          />
        </div>
        <form className="ens-search" onSubmit={lookup}>
          <input
            value={ensName}
            onChange={(event) => setEnsName(event.target.value)}
            placeholder="Find by ENSv2 name"
            aria-label="ENSv2 Sepolia name"
            required
          />
          <button className="icon-button" disabled={ensBusy} aria-label="Find member by ENS">
            <Arrow />
          </button>
        </form>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <AccessState error={error} retry={reload} />
      ) : data?.items.length ? (
        <div className="member-grid">
          {data.items.map((member) => (
            <MemberCard member={member} key={member.id} onConnect={() => setSelected(member)} />
          ))}
        </div>
      ) : (
        <Empty title="A little quiet, for now.">
          Try a broader search, or make the first invitation in Right now.
        </Empty>
      )}
      <RequestDialog
        key={selected?.id ?? "closed"}
        member={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
export function MemberView({ id }: { id: string }) {
  const { data: member, error, loading, reload } = useResource<PublicMember>("members/" + id);
  const { api, notice } = useSession(),
    [request, setRequest] = useState(false),
    [report, setReport] = useState(false),
    [reason, setReason] = useState("");
  async function block() {
    try {
      await api("blocks", { method: "POST", body: JSON.stringify({ targetId: id }) });
      notice("Member blocked. Requests and contact access are hidden.");
      await reload();
    } catch (error) {
      notice(error instanceof Error ? error.message : "Could not block.");
    }
  }
  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api("reports", { method: "POST", body: JSON.stringify({ targetId: id, reason }) });
      setReport(false);
      notice("Report received.");
    } catch (error) {
      notice(error instanceof Error ? error.message : "Could not report.");
    }
  }
  if (loading) return <Loading />;
  if (error) return <AccessState error={error} retry={reload} />;
  if (!member) return null;
  return (
    <>
      <Link href="/tokyo/people" className="back-link">
        ← Back to people
      </Link>
      <div className="profile-cover">
        <span>
          Different paths.
          <br />
          Common ground.
        </span>
        <span className="profile-cover-small">NEW FRIENDSHIP TECH / TOKYO</span>
      </div>
      <div className="profile-detail">
        <Avatar name={member.name} large />
        <div>
          <p className="eyebrow">{member.fixture ? "FICTIONAL DEMO PROFILE" : member.city}</p>
          <h1>{member.name}</h1>
          <p className="member-role">{member.role}</p>
          <p className="detail-copy">{member.bio}</p>
          <div className="tags">
            {member.interests.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
          <h3>Open to</h3>
          <div className="tags">
            {member.intents.map((tag) => (
              <Tag key={tag} lime>
                {tag}
              </Tag>
            ))}
          </div>
        </div>
        <aside>
          <button className="button lime full" onClick={() => setRequest(true)}>
            Start a conversation <Arrow />
          </button>
          <p className="muted small">
            Private contact details are shared only after mutual acceptance.
          </p>
          <button className="text-link muted" onClick={() => setReport(true)}>
            Report profile
          </button>
          <button className="text-link muted" onClick={() => void block()}>
            Block member
          </button>
        </aside>
      </div>
      <RequestDialog member={request ? member : null} onClose={() => setRequest(false)} />
      <Modal open={report} title="Report this profile" onClose={() => setReport(false)}>
        <form onSubmit={submitReport}>
          <label className="field">
            What happened?
            <textarea
              rows={4}
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button className="button lime full">Send report</button>
        </form>
      </Modal>
    </>
  );
}
export function RequestsView() {
  const { data, error, loading, reload } = useResource<{ items: ConnectionItem[] }>("requests"),
    { api, refresh, notice } = useSession();
  const [tab, setTab] = useState("All"),
    [busy, setBusy] = useState("");
  async function act(id: string, action: string) {
    setBusy(id);
    try {
      await api("requests/" + id + "/" + action, { method: "POST" });
      await reload();
      await refresh();
      notice(
        action === "accept"
          ? "You're connected. Any approved contact details are now available."
          : "Request updated.",
      );
    } catch (error) {
      notice(error instanceof Error ? error.message : "Could not update.");
    } finally {
      setBusy("");
    }
  }
  const items = data?.items.filter(
    (item) =>
      tab === "All" ||
      (tab === "Connected" && item.status === "accepted") ||
      (tab === "Received" && item.direction === "incoming") ||
      (tab === "Sent" && item.direction === "outgoing"),
  );
  return (
    <>
      <PageTitle
        eyebrow="FROM INTRODUCTION TO CONNECTION"
        title="Keep the conversation going."
        description="Requests are private. An accepted connection stays with you."
      />
      <div className="filter-chips">
        {["All", "Received", "Sent", "Connected"].map((label) => (
          <button
            key={label}
            className={"chip" + (label === tab ? " selected" : "")}
            onClick={() => setTab(label)}
          >
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <AccessState error={error} retry={reload} />
      ) : items?.length ? (
        <div className="request-list">
          {items.map((item) => (
            <article className="request-card" key={item.id}>
              <Avatar name={item.member.name} />
              <div className="request-main">
                <div className="row-between">
                  <h3>{item.member.name}</h3>
                  <Tag lime={item.status === "accepted"}>{item.status}</Tag>
                </div>
                <p className="muted small">
                  {item.member.role} · {item.direction === "incoming" ? "Received" : "Sent"}
                </p>
                <p className="request-context">{item.context}</p>
                {item.contact && (
                  <div className="contact-reveal">
                    <span>{item.member.fixture ? "Sample contact" : item.contact.type}</span>
                    {item.member.fixture ? (
                      <strong>{item.contact.value}</strong>
                    ) : (
                      <a
                        href={
                          item.contact.type === "Telegram"
                            ? "https://t.me/" + item.contact.value.replace(/^@/, "")
                            : "mailto:" + item.contact.value
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.contact.value}
                        <Arrow />
                      </a>
                    )}
                  </div>
                )}
                {item.status === "accepted" && !item.contact && (
                  <p className="note">
                    Connected. This member has not enabled contact sharing yet.
                  </p>
                )}
                {item.status === "pending" && (
                  <div className="button-row">
                    {item.direction === "incoming" ? (
                      <>
                        <button
                          className="button lime small"
                          disabled={busy === item.id}
                          onClick={() => void act(item.id, "accept")}
                        >
                          Accept <Arrow />
                        </button>
                        <button
                          className="button ghost small"
                          disabled={busy === item.id}
                          onClick={() => void act(item.id, "decline")}
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <button
                        className="button ghost small"
                        disabled={busy === item.id}
                        onClick={() => void act(item.id, "cancel")}
                      >
                        Cancel request
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Every connection starts somewhere."
          action={
            <Link href="/tokyo/people" className="button lime">
              Find your people <Arrow />
            </Link>
          }
        >
          Your introductions and accepted connections will appear here.
        </Empty>
      )}
    </>
  );
}
