// cspell:words Topo
import type { GeoPermissibleObjects } from "d3-geo";
import { GLOBE_SIZE } from "./globeView";
import { limbOpacity, onDisc, viewDot } from "./globeLimb";
import { topologyGeometry, type Topology } from "./globeTopo";

/** Zoom at which each detail tier appears. The first fetch (50m land + countries + lakes) is the cheap tier. */
export const LOD_ZOOM = {
  countries: 1,
  land50: 1.65,
  lakes: 2,
  states: 3,
  citiesMajor: 3,
  rivers: 4.5,
  citiesMid: 5,
  land10: 5.5,
  citiesLocal: 7.5,
} as const;

export type Place = readonly [name: string, lon: number, lat: number, pop: number, rank: number];

export interface GlobeLayers {
  land50?: GeoPermissibleObjects;
  land10?: GeoPermissibleObjects;
  countries?: GeoPermissibleObjects;
  states?: GeoPermissibleObjects;
  lakes?: GeoPermissibleObjects;
  rivers?: GeoPermissibleObjects;
  places?: Place[];
}

type LayerName = keyof GlobeLayers;

const files: Record<LayerName, string> = {
  land50: "land-50m.json",
  land10: "land-10m.json",
  countries: "countries-110m.json",
  states: "states.json",
  lakes: "lakes.json",
  rivers: "rivers.json",
  places: "places.json",
};

const cache = new Map<LayerName, Promise<GlobeLayers[LayerName]>>();

function urlFor(file: string): string {
  const base = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/";
  return `${base}globe/${file}`;
}

async function parseLayer(name: LayerName, data: unknown): Promise<GlobeLayers[LayerName]> {
  if (name === "places") return data as Place[];
  if (name === "states" || name === "lakes" || name === "rivers") return data as GeoPermissibleObjects;
  const topology = data as Topology;
  const objectName = name === "countries" ? "countries" : "land";
  return topologyGeometry(topology, objectName) as GeoPermissibleObjects;
}

export function loadGlobeLayer(name: LayerName): Promise<GlobeLayers[LayerName]> {
  let pending = cache.get(name);
  if (!pending) {
    pending = fetch(urlFor(files[name])).then(async (response) => {
      if (!response.ok) throw new Error(`globe layer ${name} failed`);
      return parseLayer(name, await response.json());
    });
    cache.set(name, pending);
  }
  return pending;
}

export function layersForZoom(zoom: number): LayerName[] {
  const names: LayerName[] = ["countries"];
  if (zoom >= LOD_ZOOM.land50) names.push("land50");
  if (zoom >= LOD_ZOOM.lakes) names.push("lakes");
  if (zoom >= LOD_ZOOM.states) names.push("states");
  if (zoom >= LOD_ZOOM.rivers) names.push("rivers");
  if (zoom >= LOD_ZOOM.citiesMajor) names.push("places");
  if (zoom >= LOD_ZOOM.land10) names.push("land10");
  return names;
}

/** Minimum population for a city label at this zoom; largest cities appear first. */
export function minCityPopulation(zoom: number): number {
  if (zoom >= LOD_ZOOM.citiesLocal) return 40_000;
  if (zoom >= LOD_ZOOM.citiesMid) return 150_000;
  if (zoom >= LOD_ZOOM.citiesMajor) return 800_000;
  return Number.POSITIVE_INFINITY;
}

export interface CityLabel {
  name: string;
  xy: [number, number];
  pop: number;
}

export function pickCityLabels(
  places: Place[],
  zoom: number,
  project: (point: [number, number]) => [number, number] | null,
  rotation: [number, number],
  globeR: number,
  markers: { xy: [number, number]; point: [number, number] }[],
  limit = 18
): CityLabel[] {
  const minPop = minCityPopulation(zoom);
  if (!Number.isFinite(minPop)) return [];
  const occupied = markers.map((m) => m.xy);
  const labels: CityLabel[] = [];
  for (const [name, lon, lat, pop] of places) {
    if (pop < minPop) continue;
    if (markers.some((m) => Math.hypot(m.point[0] - lon, m.point[1] - lat) < 0.25)) continue;
    const xy = project([lon, lat]);
    if (!xy || !onDisc(xy, globeR, 10)) continue;
    if (limbOpacity(viewDot([lon, lat], rotation), globeR, 10, 14) < 0.6) continue;
    if (occupied.some((p) => Math.hypot(p[0] - xy[0], p[1] - xy[1]) < 28)) continue;
    if (labels.some((label) => Math.hypot(label.xy[0] - xy[0], label.xy[1] - xy[1]) < 16)) continue;
    // Keep labels inside the 400x400 frame.
    if (xy[0] < 12 || xy[0] > GLOBE_SIZE - 12 || xy[1] < 10 || xy[1] > GLOBE_SIZE - 10) continue;
    labels.push({ name, xy, pop });
    occupied.push(xy);
    if (labels.length >= limit) break;
  }
  return labels;
}
