"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Settings, LogOut, ChevronDown, Bell } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useResource, useSession } from "./session";
import { Avatar, Modal } from "./ui";
import { ConciergeDrawer } from "./concierge-drawer";
import type { City } from "@/lib/types";

export function AppShell({ children, bleed = false }: { children: ReactNode; bleed?: boolean }) {
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
      line: "Members, connections, and who is in town.",
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
      line: "Events, member tables, and short notice plans.",
      items: [
        ["/" + citySlug + "/events", "Events", "Save a listing. A save is not a ticket."],
        ["/where-to-be", "Where to be", "The week in the city you selected."],
        ["/" + citySlug + "/now", "Right now", "Post a plan that expires on its own."],
        [
          "/" + citySlug + "/tables",
          "Tables",
          "Small meals with verified humans. Every seat is approved.",
        ],
      ],
    },
    {
      id: "intelligence",
      label: "Intelligence",
      line: "Editorial from the network, with sources.",
      items: [
        ["/intelligence", "Intelligence", "The wire, filtered by topic."],
        ["/read", "Read", "Longer pieces from the same desk."],
      ],
    },
    {
      id: "travel",
      label: "Travel",
      line: "Saved places and guides for each city.",
      items: [
        ["/" + citySlug, "Places", "The saved collection for this city."],
        ["/settings#trip", "Your trip", "A name that expires when you leave. World ID required."],
        ["/travel", "Guides", "Short city stories, labeled as such."],
        ["/cities", "Cities", "Every published city."],
      ],
    },
    {
      id: "culture",
      label: "Culture",
      line: "Exhibitions, playlists, and opportunities.",
      items: [
        ["/art", "Art", "Creators, exhibitions, and culture stories."],
        ["/music", "Music", "Playlists, artists, and shows."],
        ["/tech", "Tech", "Opportunities, companies, and people."],
      ],
    },
    {
      id: "membership",
      label: "Membership",
      line: "One plan, every city. Terms and trust.",
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
  // The bucket that owns the current page, by longest matching link.
  const here = buckets
    .flatMap((bucket) => bucket.items.map(([href]) => [bucket.id, href.split("#")[0]] as const))
    .filter(([, href]) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b[1].length - a[1].length)[0]?.[0];
  useEffect(() => setOpenBucket(null), [pathname]);
  // Anchor the menu to the header's real bottom edge (the demo bar shifts it).
  const headerRef = useRef<HTMLElement>(null),
    [menuTop, setMenuTop] = useState(80);
  useEffect(() => {
    if (openBucket && headerRef.current)
      setMenuTop(Math.round(headerRef.current.getBoundingClientRect().bottom));
  }, [openBucket]);
  useEffect(() => {
    if (!openBucket) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenBucket(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openBucket]);
  return (
    <div className="app-frame" data-menu-open={current ? "" : undefined}>
      <div className="scroll-progress" aria-hidden="true" />
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
      <header className="app-header" ref={headerRef}>
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
              data-here={here === bucket.id ? "" : undefined}
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
      <main className={"app-main" + (bleed ? " bleed" : "")} id="main">
        <div className="page-enter" key={pathname}>
          {children}
        </div>
      </main>
      {me && <ConciergeDrawer city={citySlug} />}
      <footer className="app-footer">
        <span>New Friendship Tech, presented by Urconduit.</span>
        <span>
          Tokyo · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
        </span>
      </footer>
      {current && (
        <>
          <button
            className="mega-backdrop"
            aria-label="Close menu"
            onClick={() => setOpenBucket(null)}
          />
          <div
            className="mega-menu"
            role="navigation"
            aria-label={current.label}
            key={current.id}
            style={{ ["--menu-top" as string]: menuTop + "px" }}
          >
            <div className="mega-intro">
              <p className="eyebrow">{current.label}</p>
              <h2>{current.line}</h2>
            </div>
            <div className="mega-grid">
              {current.items.map(([href, label, detail], index) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpenBucket(null)}
                  style={{ ["--i" as string]: index }}
                  aria-current={pathname === href ? "page" : undefined}
                >
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
            data-here={here === bucket.id ? "" : undefined}
            aria-expanded={openBucket === bucket.id}
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
