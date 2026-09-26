"use client";
import Link from "next/link";
import { useState } from "react";
import { Bookmark, ArrowUpRight, Search } from "lucide-react";
import { useResource, useSession } from "../session";
import { useCitySelection } from "../city-selection";
import { Eyebrow, Loading, Empty, ErrorBox, Tag } from "../ui";
import type { ContentItem, ContentSection, ContentKind } from "@/lib/types";

const SECTION_COPY: Record<ContentSection, { eyebrow: string; title: string; blurb: string }> = {
  travel: {
    eyebrow: "TRAVEL",
    title: "Where to go.",
    blurb: "City guides and gatherings from the network.",
  },
  art: {
    eyebrow: "ART",
    title: "Art.",
    blurb: "Exhibitions, creators, and galleries in the city.",
  },
  music: {
    eyebrow: "MUSIC",
    title: "Music.",
    blurb: "Playlists, artists, and live shows.",
  },
  tech: {
    eyebrow: "TECH",
    title: "Tech.",
    blurb: "Meetups, companies, and open roles.",
  },
};
const KINDS: { key: ContentKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "story", label: "Stories" },
  { key: "playlist", label: "Playlists" },
  { key: "opportunity", label: "Opportunities" },
  { key: "company", label: "Companies" },
  { key: "perk", label: "Perks" },
];
const KIND_LABEL: Record<ContentKind, string> = {
  story: "Story",
  playlist: "Playlist",
  opportunity: "Opportunity",
  company: "Company",
  perk: "Member perk",
};

export function ChannelView({ section }: { section: ContentSection }) {
  const { me, api } = useSession();
  const [kind, setKind] = useState<ContentKind | "all">("all");
  const [query, setQuery] = useState("");
  const params = new URLSearchParams({ section });
  if (kind !== "all") params.set("kind", kind);
  if (query) params.set("q", query);
  const { data, loading, error, reload } = useResource<{
    items: (ContentItem & { saved: boolean })[];
    total: number;
  }>("content?" + params);
  const copy = SECTION_COPY[section];
  async function toggleSave(item: ContentItem & { saved: boolean }) {
    if (!me) return;
    await api("saves", {
      method: "POST",
      body: JSON.stringify({ type: "content", id: item.id, saved: !item.saved }),
    });
    void reload();
  }
  const photos: Partial<Record<ContentSection, string>> = {
    art: "/photos/culture.webp",
    music: "/photos/now.webp",
    tech: "/photos/network.webp",
  };
  const photo = photos[section];
  return (
    <>
      <div className="city-hero">
        {photo && <img className="channel-photo" src={photo} alt="" />}
        <div className="city-hero-copy">
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <h1>
            {copy.title.split(".")[0]}.
            <br />
            <span>{copy.blurb}</span>
          </h1>
          <p>
            {data ? data.total : ""} {data?.total === 1 ? "entry" : "entries"}. Each links to its
            source.
          </p>
        </div>
      </div>
      <div className="discovery-tools">
        <div className="search-field">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={"Search " + section}
            aria-label={"Search " + section}
          />
        </div>
        <div className="filter-chips" role="group" aria-label="Content type">
          {KINDS.map((item) => (
            <button
              key={item.key}
              aria-pressed={kind === item.key}
              className={"chip" + (kind === item.key ? " selected" : "")}
              onClick={() => setKind(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} />
      ) : !data?.items.length ? (
        <Empty title={"Nothing here yet."}>
          This section is waiting on its first entries. Add them from the admin console.
        </Empty>
      ) : (
        <div className="content-grid">
          {data.items.map((item) => (
            <article key={item.id} className="content-card">
              <div className="content-card-head">
                <span className="kind-label">{KIND_LABEL[item.kind]}</span>
                <button
                  className={"save-toggle" + (item.saved ? " saved" : "")}
                  aria-label={item.saved ? "Remove save" : "Save"}
                  aria-pressed={item.saved}
                  disabled={!me}
                  onClick={() => void toggleSave(item)}
                >
                  <Bookmark size={15} />
                </button>
              </div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              {item.tags.length > 0 && (
                <p className="content-tags">
                  {item.tags.slice(0, 4).map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </p>
              )}
              <div className="content-card-foot">
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                  Open source <ArrowUpRight size={14} />
                </a>
                <span className="muted">
                  {new Date(item.publishedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export function TravelChannelView() {
  const { citySlug } = useCitySelection();
  const { me } = useSession();
  const [query, setQuery] = useState("");
  const params = new URLSearchParams({ section: "travel" });
  if (query) params.set("q", query);
  const { data, loading, error } = useResource<{
    items: (ContentItem & { saved: boolean })[];
    total: number;
  }>("content?" + params);
  return (
    <>
      <div className="city-hero">
        <div className="city-hero-copy">
          <Eyebrow>
            <span className="status-dot" /> TRAVEL
          </Eyebrow>
          <h1>
            Travel.
            <br />
            <span>Guides and places.</span>
          </h1>
          <p>{data?.total ?? ""} guides, plus 1,836 saved places across ten cities.</p>
          <div className="hero-pills">
            <Link href={citySlug ? "/" + citySlug : "/cities"}>
              Browse places <ArrowUpRight size={14} />
            </Link>
            <Link href={citySlug ? "/" + citySlug + "/events" : "/cities"}>
              What is on <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>
      <div className="discovery-tools">
        <div className="search-field">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search guides"
            aria-label="Search guides"
          />
        </div>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} />
      ) : !data?.items.length ? (
        <Empty title={"Nothing here yet."}>
          City guides will appear here as they are published.
        </Empty>
      ) : (
        <div className="content-grid">
          {data.items.map((item) => (
            <article key={item.id} className="content-card">
              <div className="content-card-head">
                <span className="kind-label">Guide</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <div className="content-card-foot">
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                  Open source <ArrowUpRight size={14} />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
      {!me && <div className="note">Sign in to save entries and see the full collection.</div>}
    </>
  );
}
