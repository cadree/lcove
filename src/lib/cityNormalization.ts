/**
 * City grouping on top of the bundled city list.
 * Stored profile text is left as the person typed it.
 */
import { resolveCity, suggestCities, type ResolvedCity } from "./cities.ts";

export { suggestCities };
export type { ResolvedCity };

export interface NormalizedCity {
  /** Display value for UI (Title Case, proper state abbreviations) */
  city_display: string;
  /** Normalized key for comparison/deduplication (lowercase, no extra spaces) */
  city_key: string;
}

/**
 * Normalizes a city string into display and key values
 * 
 * Examples:
 * - "Charlotte" -> { city_display: "Charlotte", city_key: "charlotte" }
 * - "charlotte " -> { city_display: "Charlotte", city_key: "charlotte" }
 * - "Charlotte, Nc" -> { city_display: "Charlotte, NC", city_key: "charlotte, nc" }
 * - "  los  angeles  " -> { city_display: "Los Angeles", city_key: "los angeles" }
 */
export function normalizeCity(rawCity: string): NormalizedCity {
  const resolved = resolveCity(rawCity);
  return {
    city_display: resolved.city_display,
    city_key: resolved.city_key,
  };
}

/**
 * Computes a city key from a raw city string (for on-the-fly deduplication)
 * Use this when you need to group/dedupe cities without the full normalization
 */
export function computeCityKey(rawCity: string | null | undefined): string {
  return resolveCity(rawCity).city_key;
}

/**
 * Computes a display value from a raw city string
 * Use this for backwards compatibility with old data that doesn't have city_display
 */
export function computeCityDisplay(rawCity: string | null | undefined): string {
  if (!rawCity) return '';
  const { city_display } = normalizeCity(rawCity);
  return city_display;
}

export interface CityFilterOption {
  key: string;
  display: string;
}

/**
 * One chip per resolved city. High-confidence typos fold into the matched city.
 * An explicit different state stays separate (Portland, OR vs Portland, ME).
 * A bare name joins the dominant city when one place is clearly larger.
 */
export function cityFilterOptions(rawCities: Array<string | null | undefined>): CityFilterOption[] {
  const options = new Map<string, string>();
  for (const raw of rawCities) {
    const resolved = resolveCity(raw);
    if (!resolved.city_key) continue;
    if (!options.has(resolved.city_key)) options.set(resolved.city_key, resolved.city_display);
  }
  return [...options.entries()]
    .map(([key, display]) => ({ key, display }))
    .sort((a, b) => a.display.localeCompare(b.display));
}

/** True when a stored city string belongs to a chip from cityFilterOptions. */
export function cityMatchesFilter(rawCity: string | null | undefined, key: string | null): boolean {
  if (key === null) return true;
  return resolveCity(rawCity).city_key === key;
}

/** Search matches the typed text or a high-confidence city, including typos. */
export function cityMatchesQuery(rawCity: string | null | undefined, query: string | null | undefined): boolean {
  const needle = (query || "").trim().toLowerCase();
  if (!needle) return true;
  const city = resolveCity(rawCity);
  const wanted = resolveCity(query);
  if (wanted.confidence !== "free" && wanted.city_key && wanted.city_key === city.city_key) return true;
  const haystack = `${rawCity || ""} ${city.city_display}`.toLowerCase();
  return haystack.includes(needle);
}

/** Two stored cities are the same place when they resolve to one key. */
export function citiesShareGroup(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = resolveCity(a);
  const right = resolveCity(b);
  return Boolean(left.city_key) && left.city_key === right.city_key;
}
