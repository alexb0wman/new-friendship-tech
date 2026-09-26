"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { cityFromPath, selectedCity } from "@/lib/city-navigation";
import type { City } from "@/lib/types";
import { useResource } from "./session";

const storageKey = "new-friendship:selected-city";
const changeEvent = "new-friendship:city-change";
let memoryPreference = "";

function readPreference() {
  try {
    return window.localStorage.getItem(storageKey) ?? memoryPreference;
  } catch {
    return memoryPreference;
  }
}

function writePreference(slug: string) {
  memoryPreference = slug;
  try {
    window.localStorage.setItem(storageKey, slug);
  } catch {
    // Browsing still works when storage is disabled.
  }
  window.dispatchEvent(new Event(changeEvent));
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      memoryPreference = "";
      listener();
    }
  };
  window.addEventListener(changeEvent, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(changeEvent, listener);
    window.removeEventListener("storage", onStorage);
  };
}

const serverPreference = () => "";

function useCityState() {
  const pathname = usePathname();
  const preference = useSyncExternalStore(subscribe, readPreference, serverPreference);
  const { data, loading, error, reload } = useResource<{ items: City[] }>("cities");
  const cities = data?.items.filter((city) => city.published) ?? [];
  const routeSlug = cityFromPath(pathname, cities)?.slug;
  const city = selectedCity(pathname, cities, preference);

  useEffect(() => {
    // Persist navigation, not storage updates from other tabs. Otherwise two tabs on
    // different city routes repeatedly overwrite one another's preference.
    if (routeSlug && routeSlug !== readPreference()) writePreference(routeSlug);
  }, [routeSlug]);

  const selectCity = useCallback(
    (slug: string) => {
      if (cities.some((item) => item.slug === slug)) writePreference(slug);
    },
    [cities],
  );

  return { city, citySlug: city?.slug ?? "", cities, loading, error, reload, selectCity };
}

const CityContext = createContext<ReturnType<typeof useCityState> | null>(null);

export function CityProvider({ children }: { children: ReactNode }) {
  const selection = useCityState();
  return <CityContext.Provider value={selection}>{children}</CityContext.Provider>;
}

export function useCitySelection() {
  const selection = useContext(CityContext);
  if (!selection) throw new Error("City provider missing");
  return selection;
}
