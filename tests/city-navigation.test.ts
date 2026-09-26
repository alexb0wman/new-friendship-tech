import { describe, expect, it } from "vitest";
import { cityDestination, cityFromPath, selectedCity } from "@/lib/city-navigation";
import type { City } from "@/lib/types";

const cities: City[] = [
  { slug: "paris", name: "Paris", timezone: "Europe/Paris", published: true },
  { slug: "tokyo", name: "Tokyo", timezone: "Asia/Tokyo", published: true },
  { slug: "seoul", name: "Seoul", timezone: "Asia/Seoul", published: false },
];

describe("city navigation", () => {
  it("matches complete path segments and published cities only", () => {
    expect(cityFromPath("/paris/events", cities)?.slug).toBe("paris");
    expect(cityFromPath("/parisian", cities)).toBeNull();
    expect(cityFromPath("/seoul", cities)).toBeNull();
  });

  it("lets a city route override the preference and keeps the preference on global pages", () => {
    expect(selectedCity("/tokyo/now", cities, "paris")?.slug).toBe("tokyo");
    expect(selectedCity("/membership", cities, "paris")?.slug).toBe("paris");
    expect(selectedCity("/", cities, "seoul")?.slug).toBe("tokyo");
    expect(selectedCity("/", cities.slice(0, 1), "deleted")?.slug).toBe("paris");
    expect(selectedCity("/", [], "tokyo")).toBeNull();
  });

  it.each(["people", "events", "now", "tables"])(
    "preserves the %s list when changing city",
    (section) => {
      expect(cityDestination("/tokyo/" + section, "tokyo", "paris")).toBe("/paris/" + section);
    },
  );

  it("does not carry IDs, place slugs, or global routes into another city", () => {
    expect(cityDestination("/tokyo/places/local-cafe", "tokyo", "paris")).toBe("/paris");
    expect(cityDestination("/tokyo/tables/table-id", "tokyo", "paris")).toBe("/paris");
    expect(cityDestination("/membership", "tokyo", "paris")).toBe("/paris");
    expect(cityDestination("/tokyo/events", "tokyo", "tokyo")).toBe("/tokyo/events");
  });
});
