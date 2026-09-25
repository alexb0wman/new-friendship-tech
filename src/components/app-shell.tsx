"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Users,
  Zap,
  CalendarDays,
  Bookmark,
  ArrowUpRight,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useResource, useSession } from "./session";
import { Avatar, Modal } from "./ui";
import type { City } from "@/lib/types";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(),
    { me, config, login, logout, switchDemo, notice } = useSession();
  const [accountOpen, setAccountOpen] = useState(false),
    [cityOpen, setCityOpen] = useState(false),
    [exploreOpen, setExploreOpen] = useState(false);
  const { data: cityData } = useResource<{ items: City[] }>("cities");
  const citySlug =
    cityData?.items.find((city) => pathname.startsWith("/" + city.slug))?.slug ?? "tokyo";
  const primary = [
    { href: "/network", label: "Network" },
    { href: "/intelligence", label: "Intelligence" },
    { href: "/" + citySlug + "/events", label: "Events" },
    { href: "/atlas", label: "Atlas" },
    { href: "/introductions", label: "Intros" },
    { href: "/membership", label: "Membership" },
    { href: "/" + citySlug + "/now", label: "Right now" },
    { href: "/standings", label: "Standings" },
  ];
  const mobile = [
    { href: "/network", label: "Network", icon: Users },
    { href: "/" + citySlug + "/events", label: "Events", icon: CalendarDays },
    { href: "/" + citySlug + "/now", label: "Now", icon: Zap },
    { href: "/atlas", label: "Atlas", icon: Compass },
    { href: "/saved", label: "Saved", icon: Bookmark },
  ];
  const explore = [
    {
      label: "Network",
      items: [
        ["/network", "Network", "People and the graph"],
        ["/atlas", "Relationship Atlas", "How everyone connects"],
        ["/companies", "Companies", "Companies in the network"],
        ["/capital", "Capital", "Investors and funds"],
        ["/cities", "Cities", "Where the network gathers"],
        ["/invite-tree", "Invite Tree", "Who invited whom"],
      ],
    },
    {
      label: "Events",
      items: [
        ["/" + citySlug + "/events", "Events", "What's on"],
        ["/where-to-be", "Where to be", "The week"],
      ],
    },
    {
      label: "Intelligence",
      items: [
        ["/intelligence", "Intelligence", "The wire"],
        ["/read", "Read", "Longer pieces"],
      ],
    },
    {
      label: "Membership",
      items: [
        ["/membership", "Membership", "All Access"],
        ["/onboarding", "Join", "Create an account"],
        ["/trust", "Trust", "What a label means"],
        ["/policy", "Member policy", "Consent and reports"],
      ],
    },
    {
      label: "Operations",
      items: [
        ["/admin", "Admin Console", "Content and reports"],
        ["/operations", "Operations", "Review queue"],
      ],
    },
  ];
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
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
        <button
          className="explore-button"
          aria-expanded={exploreOpen}
          onClick={() => setExploreOpen((open) => !open)}
        >
          Explore <ChevronDown size={14} />
        </button>
        <nav className="desktop-nav" aria-label="Main navigation">
          {primary.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={active(item.href) ? "active" : ""}
              aria-current={active(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
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
      <footer className="app-footer">
        <span>Technology, creating new friendships.</span>
        <span>
          TOKYO ALPHA · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
        </span>
      </footer>
      {exploreOpen && (
        <div className="explore-menu" role="navigation" aria-label="Explore">
          {explore.map((group) => (
            <div key={group.label}>
              <p className="eyebrow">{group.label}</p>
              {group.items.map(([href, label, detail]) => (
                <Link key={href} href={href} onClick={() => setExploreOpen(false)}>
                  <strong>{label}</strong>
                  <span>{detail}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {mobile.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={active(item.href) ? "active" : ""}
            aria-current={active(item.href) ? "page" : undefined}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </Link>
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
