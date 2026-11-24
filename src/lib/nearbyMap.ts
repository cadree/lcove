import type { Person } from "./peopleDiscovery.ts";

/**
 * Nearby street map: who is around a centre, placed no finer than a ~1 km area.
 * Members appear at their city unless they opted in to share a live area, which is
 * a point on a 0.01° grid (about 1.1 km north-south). Nothing finer is ever drawn.
 */
export const AREA_STEP = 0.01;
/** How far from the centre counts as nearby. Covers a metro area, not a region. */
export const NEARBY_KM = 60;

export type LonLat = [number, number];

const snap = (value: number, step: number) => Number((Math.round(value / step) * step).toFixed(6));

/** Snap a device position to the area grid. Returns [lon, lat]; the input is not kept. */
export function coarsen(lat: number, lon: number, step = AREA_STEP): LonLat | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [snap(lon, step), snap(lat, step)];
}

/** An area from the server, checked and re-snapped so the map can never show more detail. */
export function safeArea(value: unknown): LonLat | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [lon, lat] = value.map(Number);
  return coarsen(lat, lon);
}

export function distanceKm(a: LonLat, b: LonLat): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface MapGroup {
  key: string;
  point: LonLat;
  /** "area": a shared ~1 km live area. "city": members known only by their city. */
  kind: "area" | "city";
  label: string;
  people: Person[];
}

/** Where a member is right now for the map: a live area, else their live or profile city. */
function spot(person: Person, coordinates: Record<string, number[]>): { kind: "area" | "city"; key: string; point: LonLat; label: string } | null {
  const place = person.live || person.home;
  if (!place) return null;
  if (person.live?.area) return { kind: "area", key: `area:${person.live.area.join(",")}`, point: person.live.area, label: person.live.label };
  const point = coordinates[place.key];
  if (point?.length !== 2) return null;
  return { kind: "city", key: `city:${place.key}`, point: [point[0], point[1]], label: place.label };
}

/**
 * Discoverable members (not me) within `radiusKm` of the centre, grouped by area or city.
 * Groups are ordered nearest first; people keep their incoming order inside a group.
 */
export function nearbyGroups(
  people: Person[],
  center: LonLat,
  coordinates: Record<string, number[]>,
  me?: string,
  radiusKm = NEARBY_KM,
): MapGroup[] {
  const groups = new Map<string, MapGroup>();
  for (const person of people) {
    if (!person.discoverable || person.user_id === me) continue;
    const at = spot(person, coordinates);
    if (!at || distanceKm(center, at.point) > radiusKm) continue;
    const group = groups.get(at.key) || { key: at.key, point: at.point, kind: at.kind, label: at.label, people: [] };
    group.people.push(person);
    groups.set(at.key, group);
  }
  return [...groups.values()].sort((a, b) => distanceKm(center, a.point) - distanceKm(center, b.point) || a.key.localeCompare(b.key));
}

/** A closed ring approximating a circle of `meters` around a point, for the soft area halo. */
export function circleRing(center: LonLat, meters: number, steps = 32): LonLat[] {
  const rad = Math.PI / 180;
  const dLat = meters / 111_320;
  const dLon = meters / (111_320 * Math.max(0.01, Math.cos(center[1] * rad)));
  const ring: LonLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([center[0] + Math.cos(a) * dLon, center[1] + Math.sin(a) * dLat]);
  }
  return ring;
}
