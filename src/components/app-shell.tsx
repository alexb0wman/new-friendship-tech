"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, LogOut, ChevronDown, Bell, Check } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "./session";
import { Avatar, Modal, Loading, ErrorBox } from "./ui";
import { ConciergeDrawer } from "./concierge-drawer";
import { useCitySelection } from "./city-selection";
import { cityDestination } from "@/lib/city-navigation";

export function AppShell({ children, bleed = false }: { children: ReactNode; bleed?: boolean }) {
  const pathname = usePathname(),
    { me, config, login, logout, switchDemo } = useSession();
  const [accountOpen, setAccountOpen] = useState(false),
    [cityOpen, setCityOpen] = useState(false);
  const {
    city,
    citySlug,
    cities,
    loading: citiesLoading,
    error: citiesError,
    reload: reloadCities,
    selectCity,
  } = useCitySelection();
  const cityLink = (section = "") => (citySlug ? "/" + citySlug + section : "/cities");
  const [openBucket, setOpenBucket] = useState<string | null>(null);
  const buckets = [
    {
      id: "travel",
      label: "Travel",
      line: "The city, the week, and the table.",
      items: [
        [cityLink(), "Places", "Restaurants, galleries, and rooms we chose."],
        [cityLink("/events"), "Events", "Save a listing. A save is not a ticket."],
        ["/where-to-be", "Where to be", "The week in the city you selected."],
        [cityLink("/tables"), "Dinners", "Small meals. Every seat is approved."],
        [cityLink("/now"), "Plans", "Short notice. They expire on their own."],
        ["/travel", "Guides", "How a stay fits together."],
        ["/cities", "Cities", "Every published city."],
      ],
    },
    {
      id: "culture",
      label: "Culture",
      line: "Art, music, and the rest of the desk.",
      items: [
        ["/art", "Art", "Creators, exhibitions, and stories."],
        ["/music", "Music", "Playlists, artists, and shows."],
        ["/tech", "Tech", "Opportunities, companies, and people."],
        ["/intelligence", "Intelligence", "The wire, filtered by topic."],
        ["/read", "Read", "Longer pieces from the same desk."],
      ],
    },
    {
      id: "network",
      label: "Network",
      line: "People, introductions, and who is in town.",
      items: [
        ["/network", "People", "Search members and browse the register."],
        ["/introductions", "Intros", "Send a request, or answer one waiting for you."],
        ["/atlas", "Atlas", "Trace a warm path you are allowed to see."],
        ["/companies", "Companies", "Affiliations members have written themselves."],
        ["/capital", "Capital", "Founders and investors, not a deal room."],
        ["/standings", "Standings", "Recorded connections. Not a score of worth."],
        ["/invite-tree", "Invite Tree", "Who referred whom, when that is known."],
      ],
    },
  ];
  const current = buckets.find((bucket) => bucket.id === openBucket) ?? null;
  // The bucket that owns the current page, by longest matching link.
  const here = buckets
    .flatMap((bucket) => bucket.items.map(([href]) => [bucket.id, href.split("#")[0]] as const))
    .filter(([, href]) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b[1].length - a[1].length)[0]?.[0];
  useEffect(() => {
    setOpenBucket(null);
    setCityOpen(false);
    setAccountOpen(false);
  }, [pathname]);
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
          <strong>tech</strong>
        </Link>
        <button
          type="button"
          className="city-switch"
          aria-label="Choose city"
          aria-haspopup="dialog"
          aria-expanded={cityOpen}
          onClick={() => {
            setOpenBucket(null);
            setCityOpen(true);
          }}
        >
          {city?.name ?? "Select city"}
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
          {!me && (
            <button className="button small lime nav-cta" onClick={() => void login()}>
              Waitlist
            </button>
          )}
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
      {me && citySlug && <ConciergeDrawer city={citySlug} />}
      <footer className="app-footer">
        <span>New Friendship Tech, presented by Urconduit.</span>
        <span>
          {city ? city.name + " · " : ""}
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
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
                  key={href + label}
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
        {!me && (
          <button type="button" className="join" onClick={() => void login()}>
            <span>Waitlist</span>
          </button>
        )}
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
        {citiesLoading ? (
          <Loading />
        ) : citiesError ? (
          <div>
            <ErrorBox error={citiesError} />
            <button className="button ghost" type="button" onClick={() => void reloadCities()}>
              Retry cities
            </button>
          </div>
        ) : cities.length ? (
          <div className="menu-list">
            {cities.map((item) => (
              <Link
                key={item.slug}
                href={cityDestination(pathname, citySlug, item.slug)}
                aria-current={item.slug === citySlug ? "true" : undefined}
                onClick={() => {
                  selectCity(item.slug);
                  setCityOpen(false);
                }}
              >
                {item.name}
                {item.slug === citySlug ? (
                  <Check size={16} aria-label="Selected" />
                ) : (
                  <ArrowUpRight size={16} />
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p role="status">No cities are published yet. Please check back soon.</p>
        )}
      </Modal>
    </div>
  );
}
