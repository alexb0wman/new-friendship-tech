"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, Menu } from "lucide-react";
import { Arrow, Modal, Eyebrow } from "@/components/ui";
import { useSession } from "@/components/session";
export default function Home() {
  const [menu, setMenu] = useState(false),
    { login, config } = useSession();
  return (
    <div className="marketing">
      <header className="marketing-header">
        <Link href="/" className="wordmark">
          new friendship
          <br />
          <strong>
            tech<span className="wordmark-dot">™</span>
          </strong>
        </Link>
        <nav aria-label="Homepage navigation">
          <a href="#tokyo">Tokyo</a>
          <a href="#how">How it works</a>
          <a href="#membership">Membership</a>
        </nav>
        <div className="button-row">
          <button className="text-link desktop-only" onClick={() => void login()}>
            Log in
          </button>
          <Link href="/tokyo" className="button small ghost">
            Get connected <Arrow />
          </Link>
          <button
            className="icon-button mobile-only"
            aria-label="Open menu"
            onClick={() => setMenu(true)}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>
      <main id="main">
        <section className="landing-hero">
          <div className="landing-hero-image">
            <img
              src="/art/tokyo.svg"
              alt="Original Tokyo typographic artwork; replaceable with your city imagery"
            />
            <div className="image-overlay" />
          </div>
          <div className="landing-hero-content">
            <Eyebrow>
              <span className="status-dot" /> NEW FRIENDSHIP TECH / TOKYO ALPHA
            </Eyebrow>
            <h1>
              Your people.
              <br />
              Your places.
              <br />
              <span>Your next move.</span>
            </h1>
            <p>
              Discover places worth knowing, meet people worth knowing, and turn a new city into
              familiar ground.
            </p>
            <div className="button-row">
              <Link href="/tokyo" className="button light">
                Explore Tokyo{" "}
                <span className="button-arrow">
                  <Arrow />
                </span>
              </Link>
              <a href="#membership" className="text-link">
                See membership <Arrow />
              </a>
            </div>
            <span className="hero-footnote">One membership for every city we publish.</span>
          </div>
          <div className="hero-corner">
            <span>START SOMEWHERE</span>
            <strong>Tokyo, JP ↗</strong>
          </div>
        </section>
        <section className="proof-section">
          <p>
            Built from
            <br />
            <strong>real-world connections.</strong>
          </p>
          <div>
            <strong>60K+</strong>
            <span>
              Cumulative attendees
              <br />
              across our events
            </span>
          </div>
          <div>
            <strong>~60K</strong>
            <span>
              Newsletter
              <br />
              subscribers
            </span>
          </div>
          <span className="proof-note">Presented by Urconduit</span>
        </section>
        <section className="marketing-section" id="tokyo">
          <div className="section-heading">
            <div>
              <Eyebrow>THE CITY IS ONLY THE BEGINNING</Eyebrow>
              <h2>
                Less searching.
                <br />
                <span className="muted">More being there.</span>
              </h2>
            </div>
            <p>
              A place to work. A table to share. Somewhere the night can go. Start with what feels
              right.
            </p>
          </div>
          <div className="feature-grid">
            {[
              {
                n: "01",
                title: "Places with a point of view.",
                text: "Curated recommendations, matched to your interests.",
                art: "01",
                href: "/tokyo",
                label: "Explore places",
              },
              {
                n: "02",
                title: "People open to connecting.",
                text: "Find common ground and make a real introduction.",
                art: "03",
                href: "/tokyo/people",
                label: "Meet the network",
              },
              {
                n: "03",
                title: "A plan for right now.",
                text: "Coffee, a walk, or a work session. Good timing matters.",
                art: "06",
                href: "/tokyo/now",
                label: "Make a plan",
              },
            ].map((feature) => (
              <Link href={feature.href} className="feature-card" key={feature.n}>
                <div className="feature-art">
                  <img src={"/art/place-" + feature.art + ".svg"} alt="" loading="lazy" />
                  <span>{feature.n}</span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
                <span className="text-link">
                  {feature.label}
                  <Arrow />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="travel-section">
          <div>
            <Eyebrow>A NETWORK THAT TRAVELS WITH YOU</Eyebrow>
            <h2>
              New city.
              <br />
              <span>Familiar connections.</span>
            </h2>
            <p>
              Your people, preferences, and saved places stay with you. Every new city we publish
              joins your membership.
            </p>
            <Link className="button lime" href="/membership">
              One membership. All of it. <Arrow />
            </Link>
          </div>
          <div className="travel-graphic">
            <span className="travel-orbit orbit-one" />
            <span className="travel-orbit orbit-two" />
            <span className="travel-node node-one">
              TOKYO
              <br />
              <small>LIVE FIRST</small>
            </span>
            <span className="travel-node node-two">
              YOUR
              <br />
              PEOPLE
            </span>
            <span className="travel-node node-three">
              WHAT'S
              <br />
              NEXT ↗
            </span>
            <span className="travel-cross">＋</span>
          </div>
        </section>
        <section className="marketing-section" id="how">
          <div className="section-heading">
            <div>
              <Eyebrow>FROM ONLINE TO OUT THERE</Eyebrow>
              <h2>Make it real.</h2>
            </div>
            <p>Good connections don't need a complicated process.</p>
          </div>
          <div className="how-rows">
            {[
              [
                "01",
                "Tell us what you're into.",
                "Choose your interests and what you'd like to do.",
              ],
              [
                "02",
                "Find your place. And your people.",
                "Explore a shortlist and connect with members who opt in.",
              ],
              ["03", "Take it offline.", "Choose a place, agree a time, and go from there."],
            ].map(([n, title, text]) => (
              <div key={n}>
                <span className="eyebrow">{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
                <Arrow size={26} />
              </div>
            ))}
          </div>
        </section>
        <section className="marketing-membership" id="membership">
          <div>
            <Eyebrow>MEMBERSHIP WITHOUT THE MAZE</Eyebrow>
            <h2>
              One membership.
              <br />
              Every published city.
            </h2>
            <p>
              Tokyo is the first fully usable city. More destinations are included as their
              collections launch.
            </p>
            <div className="mini-proof">
              <span>NO CITY PASSES</span>
              <span>NO AUTO-RENEWAL</span>
            </div>
          </div>
          <div className="pricing-card">
            <Eyebrow>ALL ACCESS</Eyebrow>
            <div className="price">
              $19<span>/ 30 days</span>
            </div>
            <ul className="benefit-list">
              {[
                "Full published city collections",
                "Tailored recommendations",
                "Member discovery and requests",
                "Right now invitations",
                "Saved places and lasting connections",
                "New cities included",
              ].map((item) => (
                <li key={item}>
                  <Check size={16} />
                  {item}
                </li>
              ))}
            </ul>
            <Link className="button lime full" href="/membership">
              {config?.demo ? "Try the membership demo" : "View All Access"}
              <Arrow />
            </Link>
            <p className="muted small">
              10 new requests per access period. Meals, drinks, and separately ticketed events are
              extra. Paid launch is subject to checkout availability.
            </p>
          </div>
        </section>
        <section className="marketing-section">
          <Eyebrow>TECHNOLOGY, CREATING NEW FRIENDSHIPS</Eyebrow>
          <h2 className="heritage-title">
            The best part of the event
            <br />
            is who you leave knowing.
          </h2>
          <p className="heritage-copy">
            From founder gatherings and creative dinners to workshops, showcases, and late-night
            conversations, New Friendship Tech brings people together around what comes next.
          </p>
        </section>
        <section className="faq-section">
          <div>
            <Eyebrow>A FEW GOOD QUESTIONS</Eyebrow>
            <h2>
              Before you
              <br />
              head out.
            </h2>
          </div>
          <div>
            {[
              [
                "What is live today?",
                "The alpha is designed around Tokyo: curated places, member connections, and plans for right now. This code preview uses clearly labeled sample content until your real catalog is supplied.",
              ],
              [
                "Does one membership cover every city?",
                "Yes. All Access covers every published city and all released member features. You do not buy access again when you travel.",
              ],
              [
                "Is this just for people in crypto?",
                "No. Anyone can join. It is especially useful for people who travel around technology, business, and creative communities.",
              ],
              [
                "Do I need a wallet?",
                "You can sign in with email. Paying for membership requires a supported funded wallet. Demo payments do not move money.",
              ],
              [
                "Does membership renew automatically?",
                "No. In the alpha, you buy 30 days and renew manually.",
              ],
              [
                "Who sees my contact details?",
                "You choose whether your profile is discoverable. Contact sharing requires mutual acceptance and your explicit consent.",
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span>＋</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="final-cta">
          <Eyebrow>THE PLUG FOR WHEREVER YOU LAND</Eyebrow>
          <h2>
            Somewhere new.
            <br />
            <span>Someone you should meet.</span>
          </h2>
          <Link href="/tokyo" className="button light">
            Explore Tokyo{" "}
            <span className="button-arrow">
              <Arrow />
            </span>
          </Link>
        </section>
      </main>
      <footer className="marketing-footer">
        <Link href="/" className="wordmark">
          new friendship
          <br />
          <strong>
            tech<span className="wordmark-dot">™</span>
          </strong>
        </Link>
        <p>
          Presented by Urconduit.
          <br />
          <span className="muted">Technology, creating new friendships.</span>
        </p>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/tokyo">
            Enter the app <Arrow />
          </Link>
        </div>
      </footer>
      <Modal open={menu} title="New Friendship Tech" onClose={() => setMenu(false)}>
        <div className="menu-list">
          {[
            ["#tokyo", "Tokyo"],
            ["#how", "How it works"],
            ["#membership", "Membership"],
          ].map(([href, label]) => (
            <a href={href} key={href} onClick={() => setMenu(false)}>
              {label}
              <Arrow />
            </a>
          ))}
          <Link href="/tokyo">
            Enter the app <Arrow />
          </Link>
        </div>
      </Modal>
    </div>
  );
}
