import type { Category } from "./types";
export const PLAN = {
  key: "all_access_30d" as const,
  version: 1,
  name: "All Access",
  usdCents: 1900,
  periodSeconds: 30 * 24 * 60 * 60,
  requestLimit: 10,
};
export const CATEGORIES: Category[] = [
  "Eat",
  "Coffee",
  "Drink",
  "Work",
  "Culture",
  "Outdoors",
  "Meet",
];
export const INTERESTS = [
  "Web3",
  "AI",
  "Design",
  "Startups",
  "Art",
  "Music",
  "Food",
  "Coffee",
  "Culture",
  "Outdoors",
];
export const INTENTS = ["Coffee", "Food", "Drinks", "Work", "Walk", "Event", "Business"];
export const CITIES = [
  { slug: "bangkok", name: "Bangkok" },
  { slug: "tokyo", name: "Tokyo" },
  { slug: "taipei", name: "Taipei" },
  { slug: "seoul", name: "Seoul" },
  { slug: "kyoto", name: "Kyoto" },
  { slug: "singapore", name: "Singapore" },
  { slug: "hanoi", name: "Hanoi" },
  { slug: "ho-chi-minh-city", name: "Ho Chi Minh City" },
  { slug: "chiang-mai", name: "Chiang Mai" },
  { slug: "osaka", name: "Osaka" },
  { slug: "new-york", name: "New York" },
  { slug: "los-angeles", name: "Los Angeles" },
  { slug: "paris", name: "Paris" },
] as const;
export const NEIGHBORHOODS = [
  "Anywhere in Tokyo",
  "Shibuya",
  "Shinjuku",
  "Harajuku",
  "Ginza",
  "Roppongi",
  "Nakameguro",
  "Asakusa",
  "Ueno",
];
export const SEPOLIA_CHAIN_ID = 11155111;
export const OG_MAINNET_CHAIN_ID = 16661;
