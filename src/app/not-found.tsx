"use client";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
export default function NotFound() {
  return (
    <AppShell>
      <main className="standalone-state" id="main">
        <p className="eyebrow">404</p>
        <h1>A little off the map.</h1>
        <Link href="/tokyo" className="button lime">
          Back to Tokyo
        </Link>
      </main>
    </AppShell>
  );
}
