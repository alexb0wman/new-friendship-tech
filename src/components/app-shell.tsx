"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Settings, LogOut, ChevronDown, Bell } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useResource, useSession } from "./session";
import { Avatar, Modal } from "./ui";
import { ConciergeDrawer } from "./concierge-drawer";
import type { City } from "@/lib/types";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(),
    { me, config, login, logout, switchDemo, notice } = useSession();
  const [accountOpen, setAccountOpen] = useState(false),
    [cityOpen, setCityOpen] = useState(false);
  const { data: cityData } = useResource<{ items: City[] }>("cities");
  const citySlug =
    cityData?.items.find((city) => pathname.startsWith("/" + city.slug))?.slug ?? "tokyo";
  const [openBucket, setOpenBucket] = useState<string | null>(null);
  const buckets = [
    {
      id: "network",
      label: "Network",
      line: "People, paths, and the register.",
      items: [
        ["/network", "Network", "Search people and browse the register."],
        ["/atlas", "Atlas", "Trace a warm path you are allowed to see."],
        ["/introductions", "Intros", "Send a request, or answer one waiting for you."],
        ["/companies", "Companies", "Affiliations members have written themselves."],
        ["/capital", "Capital", "Founders and investors, not a deal room."],
        ["/cities", "Cities", "Where members actually gather."],
        ["/standings", "Standings", "Recorded connections. Not a score of worth."],
        ["/invite-tree", "Invite Tree", "Who referred whom, when that is known."],
      ],
    },
    {
      id: "events",
      label: "Events",
      line: "What is on, and what you are doing now.",
      items: [
        ["/" + citySlug + "/events", "Events", "Save a listing. A save is not a ticket."],
        ["/where-to-be", "Where to be", "The week in the city you selected."],
        ["/" + citySlug + "/now", "Right now", "Post a plan that expires on its own."],
        ["/" + citySlug + "/tables", "Tables", "Small meals with verified humans. Every seat is approved."],
      ],
    },
    {
      id: "intelligence",
      label: "Intelligence",
      line: "Sourced stories. Nothing without a source.",
      items: [
        ["/intelligence", "Intelligence", "The wire, filtered by topic."],
        ["/read", "Read", "Longer pieces from the same desk."],
      ],
    },
    {
      id: "travel",
      label: "Travel",
      line: "Places and guides for the city you are in.",
      items: [
        ["/" + citySlug, "Places", "The saved collection for this city."],
        ["/settings#trip", "Your trip", "A name that expires when you leave. World ID required."],
        ["/travel", "Guides", "Short city stories, labeled as such."],
        ["/cities", "Cities", "Every published city, Tokyo first."],
      ],
    },
    {
      id: "culture",
      label: "Culture",
      line: "Art, music, and tech in one membership.",
      items: [
        ["/art", "Art", "Creators, exhibitions, and culture stories."],
        ["/music", "Music", "Playlists, artists, and shows."],
        ["/tech", "Tech", "Opportunities, companies, and people."],
      ],
    },
    {
      id: "membership",
      label: "Membership",
      line: "One plan. The rules are on the page.",
      items: [
        ["/membership", "Membership", "All Access, thirty days, every city."],
        ["/onboarding", "Join", "Create an account and set your profile."],
        ["/trust", "Trust", "What a label means, and what it does not."],
        ["/policy", "Member policy", "Consent, blocks, and reports."],
        ...(me?.user.admin
          ? [
              ["/admin", "Admin", "Add or edit any entry."],
              ["/operations", "Operations", "Reports and the review queue."],
            ]
          : []),
      ],
    },
  ];
  const current = buckets.find((bucket) => bucket.id === openBucket) ?? null;
  return (
    <div className="app-frame">
      {config?.demo && (
        <div className="demo-bar">
          <span>LOCAL DEMO · Fictional people and places. No real payments.</span>
          <select
            aria-label="Switch demo account"
            value={config.actors.find((actor) => actor.id === me?.user.id)?.key ?? ""}
            onChange={(event) => {
              if (event.target.value) void switchDemo(event.target.value);
            }}
          >
            <option value="">Guest preview</option>
            {config.actors.map((actor) => (
              <option key={actor.key} value={actor.key}>
                {actor.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <header className="app-header">
        <Link className="wordmark" href="/">
          new friendship
          <br />
          <strong>
            tech<span className="wordmark-dot">™</span>
          </strong>
        </Link>
        <button className="city-switch" onClick={() => setCityOpen(true)}>
          {cityData?.items.find((city) => city.slug === citySlug)?.name ?? "Tokyo"}
          <ChevronDown size={14} />
        </button>
        <nav className="desktop-nav" aria-label="Main navigation">
          {buckets.map((bucket) => (
            <button
              key={bucket.id}
              type="button"
              className={openBucket === bucket.id ? "active" : ""}
              aria-expanded={openBucket === bucket.id}
              onClick={() => setOpenBucket(openBucket === bucket.id ? null : bucket.id)}
            >
              {bucket.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          {me ? (
            <>
              <Link className="icon-button" href="/requests" aria-label="Connection requests">
                <Bell size={19} />
              </Link>
              <button
                className="account-button"
                onClick={() => setAccountOpen(true)}
                aria-label="Account menu"
              >
                <Avatar name={me.user.name} />
              </button>
            </>
          ) : (
            <button className="button small light" onClick={() => void login()}>
              Sign in <ArrowUpRight size={16} />
            </button>
          )}
        </div>
      </header>
      <main className="app-main" id="main">
        {children}
      </main>
      {me && <ConciergeDrawer city={citySlug} />}
      <footer className="app-footer">
        <span>Technology, creating new friendships.</span>
        <span>
          TOKYO ALPHA · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
        </span>
      </footer>
      {current && (
        <>
          <button className="mega-backdrop" aria-label="Close menu" onClick={() => setOpenBucket(null)} />
          <div className="mega-menu" role="navigation" aria-label={current.label}>
            <div className="mega-intro">
              <p className="eyebrow">{current.label}</p>
              <h2>{current.line}</h2>
            </div>
            <div className="mega-grid">
              {current.items.map(([href, label, detail]) => (
                <Link key={href} href={href} onClick={() => setOpenBucket(null)}>
                  <strong>{label}</strong>
                  <span>{detail}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {buckets.map((bucket) => (
          <button
            key={bucket.id}
            type="button"
            className={openBucket === bucket.id ? "active" : ""}
            onClick={() => setOpenBucket(openBucket === bucket.id ? null : bucket.id)}
          >
            <span>{bucket.label}</span>
          </button>
        ))}
      </nav>
      <Modal open={accountOpen} title="Your account" onClose={() => setAccountOpen(false)}>
        {me && (
          <>
            <div className="account-summary">
              <Avatar name={me.user.name} large />
              <div>
                <h3>{me.user.name}</h3>
                <p className="muted">
                  {me.membership.active ? "All Access member" : "Preview account"}
                </p>
              </div>
            </div>
            <div className="menu-list">
              {[
                ["/settings", "Profile & settings"],
                ["/membership", "Membership"],
                ["/requests", "Connections"],
                ...(me.user.admin ? [["/admin", "Content & operations"]] : []),
              ].map(([href, label]) => (
                <Link href={href} key={href} onClick={() => setAccountOpen(false)}>
                  {label}
                  <ArrowUpRight size={16} />
                </Link>
              ))}
              <button
                onClick={() => {
                  void logout();
                  setAccountOpen(false);
                }}
              >
                <span>Sign out</span>
                <LogOut size={16} />
              </button>
            </div>
          </>
        )}
      </Modal>
      <Modal open={cityOpen} title="Where are you?" onClose={() => setCityOpen(false)}>
        <p className="muted">One membership covers every published city.</p>
        <div className="menu-list">
          {cityData?.items.map((city) => (
            <Link key={city.slug} href={"/" + city.slug} onClick={() => setCityOpen(false)}>
              {city.name}
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
        <div className="note">
          Tokyo is first. More cities will appear here as their collections are ready.
        </div>
      </Modal>
    </div>
  );
}
