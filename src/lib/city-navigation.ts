import type { City } from "./types";

export function cityFromPath(pathname: string, cities: readonly City[]) {
  const slug = pathname.split("/")[1];
  return cities.find((city) => city.published && city.slug === slug) ?? null;
}

export function selectedCity(pathname: string, cities: readonly City[], preference: string) {
  return (
    cityFromPath(pathname, cities) ??
    cities.find((city) => city.published && city.slug === preference) ??
    cities.find((city) => city.published && city.slug === "tokyo") ??
    cities.find((city) => city.published) ??
    null
  );
}

export function cityDestination(pathname: string, currentSlug: string, nextSlug: string) {
  const [, routeCity, section, detail] = pathname.split("/");
  // A place slug or table ID belongs to its original city. Only list sections transfer.
  const suffix =
    routeCity === currentSlug && !detail && ["people", "events", "now", "tables"].includes(section)
      ? "/" + section
      : "";
  return "/" + nextSlug + suffix;
}

export function cityLabel(slug: string) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
