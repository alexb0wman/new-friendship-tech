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
    [cityOpen, setCityOpen] = useState(false);
  const { data: cityData } = useResource<{ items: City[] }>("cities");
  const citySlug =
    cityData?.items.find((city) => pathname.startsWith("/" + city.slug))?.slug ?? "tokyo";
  const nav = [
    { href: "/" + citySlug, label: "Explore", icon: Compass },
    { href: "/" + citySlug + "/people", label: "People", icon: Users },
    { href: "/" + citySlug + "/now", label: "Right now", icon: Zap },
    { href: "/" + citySlug + "/events", label: "Events", icon: CalendarDays },
    { href: "/saved", label: "Saved", icon: Bookmark },
  ];
  const active = (href: string) =>
    href === "/" + citySlug
      ? pathname === href || pathname.startsWith(href + "/places")
      : pathname.startsWith(href);
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
          {nav.map((item) => (
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
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={active(item.href) ? "active" : ""}
            aria-current={active(item.href) ? "page" : undefined}
          >
            <item.icon size={20} />
            <span>{item.label === "Right now" ? "Now" : item.label}</span>
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
