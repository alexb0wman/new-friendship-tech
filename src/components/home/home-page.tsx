"use client";
import Link from "next/link";
import { ArrowUpRight, Check, Plus } from "lucide-react";
import { useSession } from "@/components/session";
import { useCitySelection } from "@/components/city-selection";
import { PLAN } from "@/lib/constants";
import { formatUsd } from "@/lib/money";
import { PreviewList, Reveal, SplitWords, type PreviewItem } from "@/components/motion";

const flows: PreviewItem[] = [
  {
    href: "/tokyo",
    title: "See",
    line: "Landmarks, galleries, coffee, bars, and rooms we chose.",
    photo: "/photos/places.webp",
  },
  {
    href: "/tokyo/tables",
    title: "Dine",
    line: "Small dinners. Every seat is approved.",
    photo: "/photos/tables.webp",
  },
  {
    href: "/travel",
    title: "Explore",
    line: "City guides for a stay. Where the days actually go.",
    photo: "/photos/trip.webp",
  },
  {
    href: "/tokyo/now",
    title: "Meet",
    line: "Short notice plans. They expire within hours.",
    photo: "/photos/now.webp",
  },
  {
    href: "/art",
    title: "Discover",
    line: "Art, music, and what the desk is paying attention to.",
    photo: "/photos/culture.webp",
  },
  {
    href: "/network",
    title: "Connect",
    line: "The member directory and connection requests.",
    photo: "/photos/night.webp",
  },
];

const ticker = ["Travel", "Music", "Art", "Fashion", "Culture", "Technology"];

const steps = [
  ["Tell us what you're into.", "Choose your interests and what you'd like to do."],
  ["Open the shortlist.", "Restaurants, galleries, coffee, bars, and rooms, already chosen."],
  ["Make it real.", "Choose a place, agree a time, and take the connection offline."],
];

const benefits = [
  "Full access to every published city collection",
  "Recommendations tailored to your interests",
  "Member discovery and connection requests",
  "Now invitations and member dinners",
  "Saved places and connections that travel with you",
  "New cities included as they launch",
];

const faqs = [
  [
    "Does one membership cover every city?",
    "Yes. All Access covers every published city and all released member features. You do not buy access again when you travel.",
  ],
  [
    "Is this just for people in crypto?",
    "No. Anyone can join. It is especially useful for people who travel around technology, business, and creative communities.",
  ],
  [
    "Do I need a wallet to sign up?",
    "You can start with email. Paying for membership requires a supported funded wallet; the app guides you through the available options.",
  ],
  [
    "Does membership renew automatically?",
    "No. Each purchase covers 30 days. You choose whether to renew.",
  ],
  [
    "Are events and meals included?",
    "Membership helps you discover and connect. Separately ticketed events, venue charges, meals, and drinks are paid separately.",
  ],
  [
    "Who can see my profile and contact details?",
    "You choose whether your profile appears in member discovery. Contact details are shared only after you both accept.",
  ],
  [
    "What is a trip?",
    "A stay in a published city. Guides, places, and plans for the days you are there.",
  ],
];

function Pill({ src, index }: { src: string; index: number }) {
  return (
    <span className="hero-pill" style={{ ["--p" as string]: index }} aria-hidden="true">
      <img src={src} alt="" />
    </span>
  );
}

export function HomePage() {
  const { me, login } = useSession();
  const { city, citySlug } = useCitySelection();
  const cityName = city?.name ?? "cities";
  const cityHref = (section = "") => (citySlug ? "/" + citySlug + section : "/cities");
  const cityFlows = flows.map((item) => ({
    ...item,
    href: item.href.startsWith("/tokyo") ? cityHref(item.href.slice("/tokyo".length)) : item.href,
  }));
  return (
    <div className="home">
      {/* 1. Hero: the one orchestrated load sequence on the page */}
      <section className="home-hero" aria-labelledby="home-title">
        <p className="hero-status load-fade">
          <span className="status-dot pulse" /> Tokyo alpha
        </p>
        <h1 id="home-title" className="hero-title load-words">
          <SplitWords text="A network" />
          <Pill src="/photos/night.webp" index={0} /> <SplitWords text="built on life" offset={2} />{" "}
          <SplitWords text="changing" offset={5} />
          <Pill src="/photos/trip.webp" index={1} /> <SplitWords text="experiences." offset={6} />
        </h1>
        <div className="hero-foot load-fade">
          <p>Become a member today and unlock exclusive early access.</p>
          <div className="button-row">
            <Link href={cityHref()} className="button lime">
              Explore {cityName} <ArrowUpRight size={16} />
            </Link>
            {me ? (
              <Link href={cityHref("/people")} className="button ghost">
                Find your people
              </Link>
            ) : (
              <button type="button" className="button ghost" onClick={() => void login()}>
                Log in
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Scroll-linked frame: opens from inset to full width as it enters */}
      <figure className="hero-frame">
        <div className="hero-frame-inner">
          <img
            src="/photos/hero.webp"
            alt="People crossing a city intersection, seen from above"
            fetchPriority="high"
          />
        </div>
        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {ticker.concat(ticker, ticker).map((item, index) => (
              <span key={item + index}>{item}</span>
            ))}
          </div>
        </div>
      </figure>

      {/* 2. Real-world foundation. Two founder-supplied figures, kept separate on purpose. */}
      <section className="home-foundation" aria-labelledby="foundation-title">
        <Reveal as="div" variant="words" className="foundation-copy">
          <h2 id="foundation-title">
            <SplitWords text="A shortlist, not a feed." />
          </h2>
          <p>
            Restaurants, galleries, coffee, bars, work rooms, and shows are hand selected. Members
            do not add spots. This list stays curated.
          </p>
        </Reveal>
      </section>

      {/* 3. What members do: hover index with a pointer-following photo */}
      <section id="work" className="home-index" aria-labelledby="index-title">
        <div className="home-section-head">
          <Reveal as="h2" variant="words" id="index-title">
            <SplitWords text="The shortlist." />
          </Reveal>
          <p>Dinners, galleries, trips, and the people in town.</p>
        </div>
        <PreviewList items={cityFlows} label="What you can do" />
      </section>

      {/* 4. How it works. A real sequence, so it gets numbers. */}
      <section className="home-steps" aria-labelledby="steps-title">
        <div className="home-section-head">
          <Reveal as="h2" variant="words" id="steps-title">
            <SplitWords text="From a new city to a plan." />
          </Reveal>
        </div>
        <ol>
          {steps.map(([title, line], index) => (
            <Reveal as="li" key={title} delay={index * 110}>
              <span className="step-number" aria-hidden="true">
                {index + 1}
              </span>
              <h3>{title}</h3>
              <p>{line}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* 5. Right now */}
      <section className="home-now" aria-labelledby="now-title">
        <div className="now-copy">
          <Reveal as="h2" variant="words" id="now-title">
            <SplitWords text="Good connections need good timing." />
          </Reveal>
          <p>
            Open to coffee? Looking for a work buddy? Put a simple plan out there and see who's
            interested.
          </p>
          <p className="muted small">
            You choose what to share. Contact details are revealed only after you both accept.
          </p>
          <Link href={cityHref("/now")} className="button ghost">
            See what's happening <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="now-visual">
          <img
            src="/photos/now.webp"
            alt="A taxi waits under karaoke signs on a Tokyo street at night"
            loading="lazy"
          />
          <Reveal as="figure" className="now-example" aria-label="Example invitation">
            <span className="example-label">Example</span>
            <div className="now-example-top">
              <span className="now-ring" aria-hidden="true">
                <svg viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="19" />
                  <circle cx="22" cy="22" r="19" pathLength="100" />
                </svg>
              </span>
              <div>
                <strong>Coffee in Shibuya</strong>
                <span>Open for the next two hours</span>
              </div>
            </div>
            <span className="now-example-action" aria-hidden="true">
              Request to join
            </span>
          </Reveal>
        </div>
      </section>

      {/* 6. Membership */}
      <section id="membership" className="home-membership" aria-labelledby="membership-title">
        <div className="membership-copy">
          <Reveal as="h2" variant="words" id="membership-title">
            <SplitWords text="One membership. Every published city." />
          </Reveal>
          <p>Checkout opens after the hackathon. Accounts and previews are open now.</p>
        </div>
        <Reveal as="div" className="membership-card">
          <div className="membership-card-head">
            <h3>All Access</h3>
            <p className="membership-price">
              <strong>{formatUsd(PLAN.usdCents)}</strong>
              <span>/ 30 days</span>
            </p>
          </div>
          <ul>
            {benefits.map((benefit) => (
              <li key={benefit}>
                <Check size={16} aria-hidden="true" />
                {benefit}
              </li>
            ))}
          </ul>
          <p className="muted small">
            {formatUsd(PLAN.usdCents)} for 30 days. Renew manually. Separately ticketed events,
            meals, and drinks are not included.
          </p>
          <div className="button-row">
            <Link href="/membership" className="button lime">
              Read the plan <ArrowUpRight size={16} />
            </Link>
            <Link href={cityHref()} className="text-link">
              Preview {cityName} first
            </Link>
          </div>
        </Reveal>
      </section>

      {/* 7. FAQ */}
      <section className="home-faq" aria-labelledby="faq-title">
        <div className="home-section-head">
          <Reveal as="h2" variant="words" id="faq-title">
            <SplitWords text="Questions, answered." />
          </Reveal>
        </div>
        <div className="faq-list">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <Plus size={20} aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 8. Final call to action */}
      <section className="home-final" aria-labelledby="final-title">
        <Reveal as="h2" variant="words" id="final-title">
          <SplitWords text="Make somewhere new feel like somewhere you belong." />
        </Reveal>
        <Link href={cityHref()} className="button lime">
          Explore {cityName} <ArrowUpRight size={16} />
        </Link>
      </section>
    </div>
  );
}
