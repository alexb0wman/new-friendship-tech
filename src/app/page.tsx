"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useSession } from "@/components/session";
import { AppShell } from "@/components/app-shell";

const flows = [
  { href: "/tokyo", title: "Places", line: "1,836 saved places across ten cities.", photo: "/photos/places.webp" },
  { href: "/tokyo/tables", title: "Tables", line: "Small dinners hosted by members. Seats are approved.", photo: "/photos/tables.webp" },
  { href: "/settings#trip", title: "Your trip", line: "An ENS name for your stay, verified with World ID.", photo: "/photos/trip.webp" },
  { href: "/network", title: "Network", line: "The member directory and connection requests.", photo: "/photos/network.webp" },
  { href: "/tokyo/now", title: "Right now", line: "Short notice plans. They expire within hours.", photo: "/photos/now.webp" },
  { href: "/art", title: "Culture", line: "Exhibitions, playlists, and opportunities.", photo: "/photos/culture.webp" },
];
const ticker = ["Places", "Tables", "Trip names", "Network", "Right now", "Art", "Music", "Tech"];

export default function Home() {
  const { login } = useSession();
  return (
    <AppShell>
    <div className="studio">
      <div>
        <section className="studio-hero">
          <img src="/photos/hero.webp" alt="Night street in the city" />
          <div className="studio-hero-shade" />
          <div className="studio-hero-copy">
            <p className="eyebrow">
              <span className="status-dot" /> Tokyo
            </p>
            <h1>
              A network built on life changing experiences.
            </h1>
          </div>
          <div className="studio-marquee" aria-hidden="true">
            <div>
              {ticker.concat(ticker).map((item, index) => (
                <span key={item + index}>{item}</span>
              ))}
            </div>
          </div>
          <div className="studio-hero-foot">
            <p>Members meet over dinners, shows, and trips. One membership covers every city we publish.</p>
            <div>
              <Link href="/tokyo" className="button lime">
                Explore Tokyo <ArrowUpRight size={16} />
              </Link>
              <button type="button" className="button ghost" onClick={() => void login()}>
                Log in
              </button>
            </div>
          </div>
        </section>
        <section className="studio-count">
          <p className="eyebrow">The collection</p>
          <h2>Ten cities, one membership.</h2>
          <div>
            <strong>1,836</strong>
            <span>Saved places, with map links. No ratings or reviews.</span>
          </div>
        </section>
        <section id="work" className="studio-grid" aria-label="What you can do">
          {flows.map((item, index) => (
            <Link key={item.href} href={item.href} className="studio-card">
              <img src={item.photo} alt="" />
              <div>
                <span>0{index + 1}</span>
                <strong>{item.title}</strong>
                <em>{item.line}</em>
              </div>
            </Link>
          ))}
        </section>
        <section id="membership" className="studio-member">
          <div>
            <p className="eyebrow">Membership</p>
            <h2>All Access is $19 for 30 days.</h2>
            <p>Checkout opens after the hackathon. Accounts and previews are open now.</p>
          </div>
          <Link href="/membership" className="button ghost">
            Read the plan <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
      <footer className="studio-foot">
        <span>Presented by Urconduit</span>
        <span>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </span>
      </footer>
    </div>
    </AppShell>
  );
}
