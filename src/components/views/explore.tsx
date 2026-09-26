"use client";
import Link from "next/link";
import { useState } from "react";
import { Search, SlidersHorizontal, MapPin, ArrowUpRight, Bookmark } from "lucide-react";
import { useResource, useSession } from "../session";
import {
  PageTitle,
  Eyebrow,
  Loading,
  AccessState,
  Empty,
  Modal,
  Tag,
  Arrow,
  ErrorBox,
} from "../ui";
import { PlaceCard } from "../place-card";
import { CATEGORIES, NEIGHBORHOODS } from "@/lib/constants";
import type { Place, EventItem } from "@/lib/types";

export function ExploreView({ city }: { city: string }) {
  const { me, login } = useSession(),
    [category, setCategory] = useState("All"),
    [query, setQuery] = useState(""),
    [area, setArea] = useState("Anywhere in Tokyo"),
    [filters, setFilters] = useState(false);
  const params = new URLSearchParams({ city, category, q: query, neighborhood: area });
  const { data, loading, error, reload } = useResource<{ items: Place[]; access: string }>(
    "places?" + params,
  );
  return (
    <>
      <div className="city-hero">
        <div className="city-hero-copy">
          <Eyebrow>
            <span className="status-dot" /> TOKYO, JAPAN
          </Eyebrow>
          <h1>
            Tokyo,
            <br />
            <span>saved by members.</span>
          </h1>
          <p>
            Places worth the trip, people worth meeting, and a plan for tonight.
          </p>
          <div className="hero-pills">
            <Link href="/tokyo/now">
              Make a plan <Arrow />
            </Link>
            <Link href="/tokyo/people">
              Find your people <Arrow />
            </Link>
          </div>
        </div>
        <div className="city-poster">
          <img src="/art/tokyo.svg" alt="Original typographic Tokyo city artwork" />
          <span className="poster-caption">
            35°40′ N / 139°45′ E <span>01 / TOKYO</span>
          </span>
        </div>
      </div>
      {!me?.user.onboarded && me && (
        <Link className="onboarding-banner" href="/onboarding">
          <span>
            <strong>Make Tokyo yours.</strong> A few details make the recommendations more useful.
          </span>
          <Arrow />
        </Link>
      )}
      <div className="section-heading">
        <div>
          <Eyebrow>PLACES</Eyebrow>
          <h2>{me?.user.onboarded ? "Picked for you." : "Browse the collection."}</h2>
        </div>
        <p className="muted">
          {me?.membership.active ? "Your All Access collection" : "A taste of what is inside"}
        </p>
      </div>
      <div className="discovery-tools">
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="Search places"
            placeholder="A place, a neighborhood…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <button
          className={"button ghost" + (area !== "Anywhere in Tokyo" ? " selected" : "")}
          onClick={() => setFilters(true)}
        >
          <SlidersHorizontal size={17} /> Filters{area !== "Anywhere in Tokyo" ? " · 1" : ""}
        </button>
      </div>
      <div className="filter-chips" role="group" aria-label="Place categories">
        {["All", ...CATEGORIES].map((item) => (
          <button
            key={item}
            className={"chip" + (category === item ? " selected" : "")}
            onClick={() => setCategory(item)}
            aria-pressed={category === item}
          >
            {item}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <AccessState error={error} retry={reload} />
      ) : data?.items.length ? (
        <div className="place-grid">
          {data.items.map((place) => (
            <PlaceCard place={place} key={place.id} />
          ))}
        </div>
      ) : (
        <Empty
          title="Let's open up the search."
          action={
            <button
              className="button ghost"
              onClick={() => {
                setCategory("All");
                setQuery("");
                setArea("Anywhere in Tokyo");
              }}
            >
              Clear filters
            </button>
          }
        >
          Try another category or neighborhood.
        </Empty>
      )}
      {data?.access === "preview" && (
        <div className="inline-membership">
          <div>
            <Eyebrow>MEMBERS</Eyebrow>
            <h2>The full list is for members.</h2>
            <p className="muted">
              Sign up to see every place, the directory, and short notice plans.
            </p>
          </div>
          <button type="button" className="button lime" onClick={() => void login()}>
            Page 2 · Sign up <Arrow />
          </button>
        </div>
      )}
      <Modal open={filters} title="Find your corner of Tokyo" onClose={() => setFilters(false)}>
        <label className="field">
          Neighborhood
          <select value={area} onChange={(event) => setArea(event.target.value)}>
            {NEIGHBORHOODS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <div className="row-between">
          <button className="button ghost" onClick={() => setArea("Anywhere in Tokyo")}>
            Clear
          </button>
          <button className="button lime" onClick={() => setFilters(false)}>
            Show places <Arrow />
          </button>
        </div>
      </Modal>
    </>
  );
}
export function PlaceView({ slug }: { slug: string }) {
  const { api, me, login, notice } = useSession();
  const {
    data: place,
    loading,
    error,
    reload,
  } = useResource<Place>("places/" + encodeURIComponent(slug));
  if (loading) return <Loading />;
  if (error) return <AccessState error={error} retry={reload} />;
  if (!place) return null;
  async function save() {
    if (!me) return login();
    if (!place) return;
    try {
      await api("saves", {
        method: "POST",
        body: JSON.stringify({ type: "place", id: place.id, saved: !place.saved }),
      });
      await reload();
    } catch (error) {
      notice(error instanceof Error ? error.message : "Could not save.");
    }
  }
  return (
    <>
      <Link href={"/" + place.city} className="back-link">
        ← Back to the collection
      </Link>
      <div className="detail-grid">
        <div>
          <div className={"detail-art art-" + place.artwork}>
            <img
              src={place.photo?.src ?? "/art/place-" + place.artwork + ".svg"}
              alt=""
              style={place.photo ? { objectPosition: place.photo.position } : undefined}
            />
            <span>{place.neighborhood}</span>
          </div>
          <div className="tags">
            {place.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
          <h2>Why this place</h2>
          <p className="detail-copy">{place.note}</p>
          {place.fixture && (
            <div className="note">
              This is a fictional place created to demonstrate the product. Replace it with your own
              reviewed recommendation.
            </div>
          )}
        </div>
        <aside className="detail-aside">
          <Eyebrow>
            {place.category} / {place.neighborhood}
          </Eyebrow>
          <h1>{place.name}</h1>
          <p className="muted">A starting point for your next good conversation.</p>
          <div className="detail-facts">
            <span>
              Neighborhood<strong>{place.neighborhood}</strong>
            </span>
            <span>
              Current hours<strong>Check before visiting</strong>
            </span>
            <span>
              Curator review
              <strong>
                {place.reviewedAt
                  ? new Date(place.reviewedAt).toLocaleDateString("en")
                  : "Not yet reviewed"}
              </strong>
            </span>
          </div>
          <a
            href={place.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button lime full"
          >
            {place.fixture ? "View neighborhood map" : "Open in Google Maps"}
            <Arrow />
          </a>
          <button className="button ghost full" onClick={() => void save()}>
            <Bookmark size={17} fill={place.saved ? "currentColor" : "none"} />
            {place.saved ? "Saved to your places" : "Save this place"}
          </button>
          <Link href={"/" + place.city + "/now"} className="text-link">
            Make a plan here <Arrow />
          </Link>
        </aside>
      </div>
    </>
  );
}
export function SavedView() {
  const { data, error, loading, reload } = useResource<{ places: Place[]; events: EventItem[] }>(
    "saves",
  );
  return (
    <>
      <PageTitle
        eyebrow="SAVED"
        title="Keep the good ones."
        description="Places and events you have saved, in every city."
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <AccessState error={error} retry={reload} />
      ) : data && (data.places.length || data.events.length) ? (
        <>
          <div className="place-grid">
            {data.places.map((place) => (
              <PlaceCard key={place.id} place={place} onSaved={reload} />
            ))}
          </div>
          {data.events.length > 0 && (
            <>
              <div className="section-heading">
                <h2>Saved events</h2>
              </div>
              {data.events.map((event) => (
                <div className="event-row" key={event.id}>
                  <div>
                    <h3>{event.title}</h3>
                    <p className="muted">
                      {event.neighborhood} · {event.accessNote}
                    </p>
                  </div>
                  <Link href={"/" + event.city + "/events"} className="button ghost">
                    View events <Arrow />
                  </Link>
                </div>
              ))}
            </>
          )}
        </>
      ) : (
        <Empty
          title="Start a collection worth keeping."
          action={
            <Link href="/tokyo" className="button lime">
              Explore Tokyo <Arrow />
            </Link>
          }
        >
          Tap the bookmark on a place that catches your eye.
        </Empty>
      )}
    </>
  );
}
