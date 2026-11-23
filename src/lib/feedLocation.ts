/**
 * Home feed Location filter. Profiles store one free-text city, resolved
 * against the bundled city list, so a city (or a borough or neighborhood the
 * list knows, such as Manhattan or Adams Morgan) is the finest level there is.
 */
import { resolveCity, suggestCities } from "./cities.ts";

export interface FeedLocation {
  key: string;
  label: string;
}

export interface LocationChoice extends FeedLocation {
  /** Members whose profile city resolves to this place. */
  members: number;
}

const STORAGE_PREFIX = "ether.feed-location.";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function feedLocationStorageKey(userId: string | null | undefined): string {
  return STORAGE_PREFIX + (userId || "guest");
}

export function readFeedLocation(store: Store | null | undefined, userId: string | null | undefined): FeedLocation | null {
  try {
    const raw = store?.getItem(feedLocationStorageKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<FeedLocation>;
    if (typeof value?.key !== "string" || !value.key || typeof value.label !== "string" || !value.label) return null;
    return { key: value.key, label: value.label };
  } catch {
    return null;
  }
}

export function writeFeedLocation(store: Store | null | undefined, userId: string | null | undefined, location: FeedLocation | null): void {
  try {
    const key = feedLocationStorageKey(userId);
    if (location) store?.setItem(key, JSON.stringify({ key: location.key, label: location.label }));
    else store?.removeItem(key);
  } catch {
    // Private mode or full storage: the choice just won't survive a reload.
  }
}

/** The place a stored profile city belongs to, or null when it is empty. */
export function locationOf(rawCity: string | null | undefined): FeedLocation | null {
  const resolved = resolveCity(rawCity);
  if (!resolved.city_key) return null;
  return { key: resolved.city_key, label: resolved.city_display };
}

/** True when either stored city field of a profile is in the chosen place. */
export function inFeedLocation(
  profile: { city?: string | null; city_display?: string | null } | null | undefined,
  location: FeedLocation | null,
): boolean {
  if (!location) return true;
  if (!profile) return false;
  return [profile.city, profile.city_display].some((raw) => locationOf(raw)?.key === location.key);
}

/** One choice per place members are in, busiest first. */
export function memberLocations(profiles: Array<{ city?: string | null; city_display?: string | null }>): LocationChoice[] {
  const counts = new Map<string, LocationChoice>();
  for (const profile of profiles) {
    const place = locationOf(profile.city) ?? locationOf(profile.city_display);
    if (!place) continue;
    const entry = counts.get(place.key) ?? { ...place, members: 0 };
    entry.members += 1;
    counts.set(place.key, entry);
  }
  return [...counts.values()].sort((a, b) => b.members - a.members || a.label.localeCompare(b.label));
}

/**
 * Picker rows for a search. Places members are in come first, then any place
 * from the bundled list, so someone can pick a city before anyone lives there.
 */
export function locationChoices(members: LocationChoice[], query: string, limit = 8): LocationChoice[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return members;
  const byKey = new Map(members.map((choice) => [choice.key, choice]));
  const out: LocationChoice[] = [];
  const seen = new Set<string>();
  const add = (choice: LocationChoice) => {
    if (seen.has(choice.key)) return;
    seen.add(choice.key);
    out.push(choice);
  };
  for (const choice of members) if (choice.label.toLowerCase().includes(needle)) add(choice);
  for (const city of suggestCities(query, limit)) add(byKey.get(city.key) ?? { key: city.key, label: city.label, members: 0 });
  return out;
}
