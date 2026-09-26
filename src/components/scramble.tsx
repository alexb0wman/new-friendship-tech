"use client";
import { useEffect, useState } from "react";

const glyphs = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

export function Scramble({ length = 12 }: { length?: number }) {
  const [text, setText] = useState("".padEnd(length, "X"));
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setText("".padEnd(length, "·"));
      return;
    }
    const id = window.setInterval(() => {
      setText(
        Array.from({ length }, () => glyphs[Math.floor(Math.random() * glyphs.length)]).join(""),
      );
    }, 90);
    return () => window.clearInterval(id);
  }, [length]);
  return (
    <span className="scramble" aria-hidden="true">
      {text}
    </span>
  );
}
