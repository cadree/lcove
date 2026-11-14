import { cityByKey, resolveCity } from "./cities.ts";

/** One onboarded member as the directory loads them from profiles_public. */
export interface Member {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  city_display: string | null;
  city_key: string | null;
  created_at: string | null;
  skills: string[];
  passions: string[];
}

export interface TripBadge {
  city_key: string;
  city_label: string;
  starts_on: string;
  ends_on: string;
}

/** What discovery_globe returns for each member the viewer can discover. */
export interface DiscoverySignal {
  user_id: string;
  liked: boolean | null;
  live_city_key: string | null;
  live_until: string | null;
  trip: TripBadge | null;
}

export interface Place {
  key: string;
  label: string;
}

export interface Person extends Member {
  name: string;
  role: string | null;
  home: Place | null;
  live: (Place & { until: string }) | null;
  trip: TripBadge | null;
  /** On the globe and in the swipe deck. False for members who hid themselves. */
  discoverable: boolean;
  liked: boolean | null;
}

export interface GlobeCity extends Place {
  count: number;
  live: number;
  avatars: string[];
}

export function placeForKey(key: string | null | undefined): Place | null {
  const city = cityByKey(key);
  return city ? { key: city.key, label: city.label } : null;
}

/** Canonical city for what a member typed. "Charlotte", "charlotte, nc" and "charlotte|nc" agree. */
export function homePlace(member: Pick<Member, "city" | "city_display" | "city_key">): Place | null {
  const known = placeForKey(member.city_key);
  if (known) return known;
  const typed = (member.city_display || member.city || "").trim();
  if (!typed) return null;
  const resolved = resolveCity(typed);
  return placeForKey(resolved.city_key) || { key: resolved.city_key, label: resolved.city_display || typed };
}

export function buildPeople(members: Member[], signals: DiscoverySignal[] | undefined, blocked: Iterable<string> = []): Person[] {
  const hidden = new Set(blocked);
  const byId = new Map((signals || []).map((s) => [s.user_id, s]));
  const seen = new Set<string>();
  const people: Person[] = [];
  for (const member of members) {
    if (hidden.has(member.user_id) || seen.has(member.user_id)) continue;
    seen.add(member.user_id);
    const signal = byId.get(member.user_id);
    const livePlace = signal?.live_city_key ? placeForKey(signal.live_city_key) : null;
    people.push({
      ...member,
      name: member.display_name?.trim() || "Creative",
      role: member.skills[0] || member.passions[0] || null,
      home: homePlace(member),
      live: livePlace && signal?.live_until ? { ...livePlace, until: signal.live_until } : null,
      trip: signal?.trip || null,
      discoverable: !!signal,
      liked: signal?.liked ?? null,
    });
  }
  return people;
}

/** Where a person shows on the globe: a live city wins over the profile city. */
export function placeOf(person: Person): Place | null {
  return person.live || person.home;
}

/** A state or country filter, such as "region:nc|NC" or "region:ca|Canada" (not California). */
export const REGION = "region:";

function regionOf(place: Place): string | null {
  const code = place.key.includes("|") ? place.key.split("|")[1] : "";
  const label = place.label.split(",").slice(1).join(",").trim();
  return code && label ? `${REGION}${code}|${label}` : null;
}

function inPlace(place: Place | null | undefined, key: string): boolean {
  if (!place) return false;
  return key.startsWith(REGION) ? regionOf(place) === key : place.key === key;
}

export function inCity(person: Person, key: string | null): boolean {
  if (!key) return true;
  const trip = person.trip ? { key: person.trip.city_key, label: person.trip.city_label } : null;
  return inPlace(person.home, key) || inPlace(person.live, key) || inPlace(trip, key);
}

export interface PlaceOption extends Place {
  count: number;
}

/** Picker options: cities people are in, then the states and countries those cities are in. */
export function placeOptions(people: Person[]): { cities: PlaceOption[]; regions: PlaceOption[] } {
  const cities = new Map<string, PlaceOption>();
  const regions = new Map<string, PlaceOption>();
  for (const person of people) {
    for (const place of new Set([person.home, person.live].filter(Boolean) as Place[])) {
      const city = cities.get(place.key) || { ...place, count: 0 };
      city.count++;
      cities.set(place.key, city);
      const key = regionOf(place);
      if (!key) continue;
      const entry = regions.get(key) || { key, label: key.split("|")[1], count: 0 };
      entry.count++;
      regions.set(key, entry);
    }
  }
  const order = (a: PlaceOption, b: PlaceOption) => b.count - a.count || a.label.localeCompare(b.label);
  return { cities: [...cities.values()].sort(order), regions: [...regions.values()].sort(order) };
}

export function matchesQuery(person: Person, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    person.name,
    person.bio,
    person.city,
    person.city_display,
    person.home?.label,
    person.live?.label,
    person.trip?.city_label,
    ...person.skills,
    ...person.passions,
  ];
  return haystack.some((value) => value?.toLowerCase().includes(q));
}

export function globeCities(people: Person[], coordinates: Record<string, number[]>): (GlobeCity & { point: [number, number] })[] {
  const cities = new Map<string, GlobeCity & { point: [number, number] }>();
  for (const person of people) {
    if (!person.discoverable) continue;
    const place = placeOf(person);
    const point = place && coordinates[place.key];
    if (!place || point?.length !== 2) continue;
    const city = cities.get(place.key) || { ...place, count: 0, live: 0, avatars: [], point: [point[0], point[1]] };
    city.count++;
    if (person.live) city.live++;
    if (person.avatar_url && city.avatars.length < 4) city.avatars.push(person.avatar_url);
    cities.set(place.key, city);
  }
  return [...cities.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Swipe deck: discoverable people other than me, ones I have not decided on first. */
export function deckFor(people: Person[], me: string | undefined, city: string | null, query: string): Person[] {
  const rank = (p: Person) => (p.liked === null ? 0 : p.liked ? 1 : 2);
  return people
    .filter((p) => p.discoverable && p.user_id !== me && inCity(p, city) && matchesQuery(p, query))
    .sort((a, b) => rank(a) - rank(b) || Number(!!b.live) - Number(!!a.live));
}

/** The member list: everyone, including members hidden from the globe. */
export function listFor(people: Person[], city: string | null, query: string): Person[] {
  return people.filter((p) => inCity(p, city) && matchesQuery(p, query));
}

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function tripBadge(trip: TripBadge): string {
  const city = trip.city_label.split(",")[0];
  const start = new Date(`${trip.starts_on}T00:00:00Z`);
  const end = new Date(`${trip.ends_on}T00:00:00Z`);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const range = trip.starts_on === trip.ends_on
    ? DAY.format(start)
    : `${DAY.format(start)}–${sameMonth ? end.getUTCDate() : DAY.format(end)}`;
  return `Traveling to ${city} ${range}`;
}

/** Nearest known city to a device position, so only a city key ever leaves the device. */
export function nearestCity(lat: number, lon: number, coordinates: Record<string, number[]>): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  const rad = Math.PI / 180;
  for (const [key, point] of Object.entries(coordinates)) {
    if (point.length !== 2) continue;
    const dLat = (point[1] - lat) * rad;
    const dLon = (point[0] - lon) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(point[1] * rad) * Math.sin(dLon / 2) ** 2;
    if (a < bestDistance) {
      bestDistance = a;
      best = key;
    }
  }
  // Farther than ~150 km from any known city: do not guess.
  return bestDistance <= Math.sin((150 / 6371) / 2) ** 2 ? best : null;
}
