"use client";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useState } from "react";
import type { Place } from "@/lib/types";
import { useSession } from "./session";
import { Arrow, Tag } from "./ui";
import { Scramble } from "./scramble";
export function PlaceCard({ place, onSaved }: { place: Place; onSaved?: () => void }) {
  const { api, me, login, notice } = useSession(),
    [saved, setSaved] = useState(!!place.saved),
    [busy, setBusy] = useState(false);
  async function save() {
    if (!me) return login();
    setBusy(true);
    try {
      await api("saves", {
        method: "POST",
        body: JSON.stringify({ type: "place", id: place.id, saved: !saved }),
      });
      setSaved(!saved);
      onSaved?.();
    } catch (error) {
      notice(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="place-card">
      <div className={"place-art art-" + place.artwork}>
        <Link
          href={place.locked ? "/membership" : "/" + place.city + "/places/" + place.slug}
          className="art-link"
          aria-label={place.locked ? "Sign up to see this place" : "View " + place.name}
          onClick={place.locked ? (event) => { event.preventDefault(); void login(); } : undefined}
        >
          <img
            src={place.photo?.src ?? "/art/place-" + place.artwork + ".svg"}
            alt=""
            style={place.photo ? { objectPosition: place.photo.position } : undefined}
            loading="lazy"
          />
          <span className="art-area">
            {place.neighborhood}
            <Arrow size={22} />
          </span>
        </Link>
        <span className="art-category">{place.category}</span>
        <button
          disabled={busy}
          className={"save-button" + (saved ? " saved" : "")}
          onClick={() => void save()}
          aria-label={(saved ? "Unsave " : "Save ") + place.name}
          aria-pressed={saved}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="place-body">
        <div className="row-between">
          <span className="eyebrow">
            {place.category} / {place.neighborhood}
          </span>
          {place.fixture && <span className="fixture-label">Sample</span>}
        </div>
        {place.locked ? (
          <h3>
            <Scramble length={14} />
          </h3>
        ) : (
          <Link href={"/" + place.city + "/places/" + place.slug}>
            <h3>{place.name}</h3>
          </Link>
        )}
        <p>{place.locked ? "Sign up to see this place." : place.note.split(" Fictional demo venue;")[0]}</p>
        {place.photo?.credit && <p className="photo-credit">{place.photo.credit}</p>}
        <div className="tags">
          {(place.reasons?.length ? place.reasons : place.tags.slice(0, 2)).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      </div>
    </article>
  );
}
