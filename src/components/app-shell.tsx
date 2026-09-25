"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Users,
  ArrowUpRight,
  Settings,
  LogOut,
  ChevronDown,
  Palette,
  Music2,
  Cpu,
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
    [openTopic, setOpenTopic] = useState<string | null>(null);
  const { data: cityData } = useResource<{ items: City[] }>("cities");
  const citySlug =
    cityData?.items.find((city) => pathname.startsWith("/" + city.slug))?.slug ?? "tokyo";
  const topics = [
    {
      label: "Travel",
      href: "/travel",
      items: [
        ["/" + citySlug, "Places", "The saved collection"],
        ["/" + citySlug + "/events", "Events", "What is on"],
        ["/" + citySlug + "/now", "Right now", "Temporary plans"],
        ["/travel", "Guides", "City stories"],
        ["/cities", "Cities", "Everywhere we cover"],
      ],
    },
    {
      label: "Art",
      href: "/art",
      items: [
        ["/art", "Featured", "The latest"],
        ["/art?kind=story", "Stories", "Exhibitions and creators"],
        ["/art?kind=company", "Galleries", "Featured spaces"],
      ],
    },
    {
      label: "Music",
      href: "/music",
      items: [
        ["/music", "Featured", "The latest"],
        ["/music?kind=playlist", "Playlists", "Curated listens"],
        ["/music?kind=story", "Stories", "Artists and shows"],
      ],
    },
    {
      label: "Tech",
      href: "/tech",
      items: [
        ["/tech", "Featured", "The latest"],
        ["/tech?kind=opportunity", "Opportunities", "Jobs and teams"],
        ["/tech?kind=company", "Companies", "Featured teams"],
        ["/network", "People", "The member directory"],
      ],
    },
  ];
  const plain = [
    { href: "/network", label: "Network" },
    { href: "/membership", label: "Membership" },
  ];
  const mobile = [
    { href: "/" + citySlug, label: "Travel", icon: Compass },
    { href: "/art", label: "Art", icon: Palette },
    { href: "/music", label: "Music", icon: Music2 },
    { href: "/tech", label: "Tech", icon: Cpu },
    { href: "/network", label: "Network", icon: Users },
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
        <nav className="desktop-nav" aria-label="Main navigation">
          {topics.map((topic) => (
            <span key={topic.label} className="nav-topic">
              <button
                className={"topic-button" + (active(topic.href) ? " active" : "")}
                aria-expanded={openTopic === topic.label}
                aria-haspopup="true"
                onClick={() => setOpenTopic(openTopic === topic.label ? null : topic.label)}
              >
                {topic.label} <ChevronDown size={13} />
              </button>
              {openTopic === topic.label && (
                <div className="topic-menu" role="menu">
                  {topic.items.map(([href, label, detail]) => (
                    <Link
                      key={label}
                      href={href}
                      role="menuitem"
                      onClick={() => setOpenTopic(null)}
                    >
                      <strong>{label}</strong>
                      <span>{detail}</span>
                    </Link>
                  ))}
                </div>
              )}
            </span>
          ))}
          {plain.map((item) => (
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
      {openTopic && (
        <div
          className="topic-backdrop"
          role="presentation"
          onClick={() => setOpenTopic(null)}
        />
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
