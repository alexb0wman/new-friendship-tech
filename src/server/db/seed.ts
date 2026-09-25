import { randomUUID } from "node:crypto";
import type { Database } from "./index";
import * as s from "./schema";
import { sealContact } from "@/server/privacy";
import { isDemo } from "@/server/config";
import type { Category } from "@/lib/types";

export const DEMO_IDS = {
  alex: "10000000-0000-4000-8000-000000000001",
  maya: "10000000-0000-4000-8000-000000000002",
  kenji: "10000000-0000-4000-8000-000000000003",
  ari: "10000000-0000-4000-8000-000000000004",
  sam: "10000000-0000-4000-8000-000000000005",
  admin: "10000000-0000-4000-8000-000000000006",
};
export const DEMO_ACTORS = [
  { key: "alex", id: DEMO_IDS.alex, label: "Alex · Preview member" },
  { key: "maya", id: DEMO_IDS.maya, label: "Maya · All Access" },
  { key: "admin", id: DEMO_IDS.admin, label: "Host · Admin" },
];
export async function seedDemo(db: Database) {
  if (!isDemo()) throw new Error("Sample data is local-demo only");
  await db.insert(s.cities).values([{ slug: "tokyo", name: "Tokyo", timezone: "Asia/Tokyo", published: true }, { slug: "seoul", name: "Seoul", timezone: "Asia/Seoul", published: false }]);
  const members = [
    { id: DEMO_IDS.alex, name: "Alex", role: "Designer & builder", bio: "Exploring what happens when good places bring good people together.", interests: ["AI", "Design", "Coffee"], intents: ["Coffee", "Work"] },
    { id: DEMO_IDS.maya, name: "Maya Chen", role: "AI founder", bio: "Building better ways to work. Always up for a coffee and a conversation about what comes next.", interests: ["AI", "Startups", "Coffee"], intents: ["Coffee", "Business"] },
    { id: DEMO_IDS.kenji, name: "Kenji Mori", role: "Creative technologist", bio: "Somewhere between art, code, and the next listening bar.", interests: ["Art", "Web3", "Music"], intents: ["Drinks", "Event"] },
    { id: DEMO_IDS.ari, name: "Ari Tan", role: "Product designer", bio: "Collecting quiet corners and good ideas. In Tokyo for the week.", interests: ["Design", "Culture", "Food"], intents: ["Walk", "Food"] },
    { id: DEMO_IDS.sam, name: "Sam Rivera", role: "Protocol engineer", bio: "Working on useful infrastructure. Looking for a place to build with other people.", interests: ["Web3", "AI", "Coffee"], intents: ["Work", "Coffee"] },
    { id: DEMO_IDS.admin, name: "Demo host", role: "Community host", bio: "Local demo administrator. This is a fictional account.", interests: ["Culture", "Food"], intents: ["Event"] },
  ];
  const now = Date.now();
  for (const [i, member] of members.entries()) {
    await db.insert(s.users).values({ ...member, authSubject: "demo:" + member.id, city: "tokyo", neighborhood: ["Shibuya", "Shibuya", "Nakameguro", "Harajuku", "Shinjuku", "Shibuya"][i], visible: true, onboarded: i !== 0, admin: i === 5, host: i === 5, fixture: true });
    await db.insert(s.walletLinks).values({ userId: member.id, address: "0x" + String(i + 1).padStart(40, "0") });
    await db.insert(s.privateContacts).values({ userId: member.id, sealed: await sealContact(member.id, { type: "Telegram", value: "demo_member_" + (i + 1) }), shareOnAcceptance: true });
    if (i > 0) await db.insert(s.entitlements).values({ userId: member.id, source: "demo_complimentary", startsAt: new Date(now - 3600000), endsAt: new Date(now + 29 * 86400000) });
  }
  const fixtures: [string, string, Category, string, string[]][] = [
    ["Kissa Side Street", "Shibuya", "Coffee", "A quiet coffee stop for an unhurried conversation.", ["Coffee", "Work", "Design"]],
    ["The Listening Room", "Nakameguro", "Drink", "A listening-bar concept for the evening after the conference.", ["Music", "Drinks", "Art"]],
    ["Table for Tomorrow", "Shibuya", "Eat", "A shared-table concept where the conversation can run long.", ["Food", "Business"]],
    ["Neighbourhood Studio", "Harajuku", "Culture", "An independent art-space concept to break up a day of screens.", ["Art", "Design", "Culture"]],
    ["River Walk", "Nakameguro", "Outdoors", "An easy outdoor plan with room for a proper conversation.", ["Outdoors", "Walk"]],
    ["Common Ground", "Shinjuku", "Work", "A work-session concept for builders who prefer company.", ["AI", "Web3", "Work"]],
    ["Paper & Pour", "Ginza", "Coffee", "A bookshop-and-coffee concept for your next free afternoon.", ["Coffee", "Culture"]],
    ["After Hours", "Roppongi", "Drink", "An evening meeting point for a smaller group.", ["Drinks", "Music"]],
    ["Workshop Table", "Shibuya", "Meet", "A casual space concept for exchanging ideas after a build session.", ["Startups", "AI", "Business"]],
    ["Slow Sunday", "Ueno", "Outdoors", "A gentle outdoor pause between busy days.", ["Outdoors", "Walk", "Art"]],
    ["Little Counter", "Asakusa", "Eat", "An intimate counter-dining concept for one or two.", ["Food", "Culture"]],
    ["Open Circuit", "Shinjuku", "Work", "A focused place concept for finishing what you started.", ["Web3", "AI", "Work"]],
    ["Morning Ritual", "Harajuku", "Coffee", "A morning coffee concept with a little space to think.", ["Coffee", "Design"]],
    ["The Long Table", "Ginza", "Eat", "A dinner concept built for friends and new introductions.", ["Food", "Business"]],
    ["Studio Window", "Roppongi", "Culture", "A contemporary gallery concept for a fresh perspective.", ["Art", "Culture"]],
    ["Side B", "Shibuya", "Drink", "A music-led concept for the end of the evening.", ["Music", "Drinks"]],
    ["Green Interval", "Ueno", "Outdoors", "An outdoor catch-up concept away from the crowd.", ["Outdoors", "Walk"]],
    ["Field Notes", "Nakameguro", "Coffee", "A relaxed coffee concept for collecting your thoughts.", ["Coffee", "Design"]],
    ["Build Club", "Shibuya", "Work", "A shared worktable concept for people making things.", ["AI", "Startups", "Work"]],
    ["Meet in the Middle", "Shinjuku", "Meet", "A central meeting concept for a first conversation.", ["Business", "Coffee"]],
    ["The Small Exhibition", "Harajuku", "Culture", "An art-space concept for a short, thoughtful detour.", ["Art", "Design"]],
    ["Night Kitchen", "Roppongi", "Eat", "A late dinner concept after a long conference day.", ["Food", "Drinks"]],
    ["North Window", "Ginza", "Work", "A calm workspace concept for one focused session.", ["Work", "Design"]],
    ["Hello Again", "Asakusa", "Meet", "A gathering concept for reconnecting after the week.", ["Culture", "Business"]],
  ];
  for (const [i, [name, neighborhood, category, note, tags]] of fixtures.entries()) {
    await db.insert(s.places).values({ id: randomUUID(), slug: "sample-" + name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
      city: "tokyo", name, neighborhood, category, note: note + " Fictional demo venue; replace with a reviewed recommendation before launch.",
      tags, mapUrl: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(neighborhood + ", Tokyo"),
      sourceUrl: "https://example.com/sample-content", price: null, preview: i < 6, published: true, fixture: true, artwork: String((i % 6) + 1).padStart(2, "0") });
  }
  await db.insert(s.nowPosts).values([
    { userId: DEMO_IDS.maya, city: "tokyo", neighborhood: "Shibuya", kind: "Coffee", note: "A coffee and a conversation about what you're building?", startsAt: new Date(now), expiresAt: new Date(now + 2 * 3600000) },
    { userId: DEMO_IDS.sam, city: "tokyo", neighborhood: "Shinjuku", kind: "Work", note: "Two hours of focused building. Bring your laptop.", startsAt: new Date(now), expiresAt: new Date(now + 3 * 3600000) },
    { userId: DEMO_IDS.kenji, city: "tokyo", neighborhood: "Nakameguro", kind: "Drinks", note: "Looking for a listening bar after the conference.", startsAt: new Date(now), expiresAt: new Date(now + 4 * 3600000) },
  ]);
  await db.insert(s.events).values([
    { city: "tokyo", title: "Builders around the table", neighborhood: "Shibuya", startsAt: new Date(now + 86400000), endsAt: new Date(now + 93600000), registrationUrl: "https://example.com/demo-event", sourceUrl: "https://example.com/demo-event", accessNote: "Example event only. No real registration.", published: true, fixture: true },
    { city: "tokyo", title: "Culture after the conference", neighborhood: "Harajuku", startsAt: new Date(now + 172800000), endsAt: new Date(now + 183600000), registrationUrl: "https://example.com/demo-event", sourceUrl: "https://example.com/demo-event", accessNote: "Example event only. No real registration.", published: true, fixture: true },
  ]);
  await db.insert(s.auditLog).values({ action: "demo.seed", entityId: "local", correlationId: randomUUID() });
}
