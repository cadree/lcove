import { geoGraticule, type GeoPermissibleObjects } from "d3-geo";

/** Two muted palettes. `natural` is the default; `jewel` is a slightly richer alternate. */
export type GlobeLook = "natural" | "jewel";
export type LandTint = "tropical" | "temperate" | "boreal" | "ice" | "desert";

export interface GlobePaint {
  ocean: [string, string, string];
  oceanStroke: string;
  land: Record<LandTint, string>;
  landStroke: string;
  day: string;
  night: string;
  atmosphere: string;
}

export const GLOBE_PAINT: Record<GlobeLook, GlobePaint> = {
  natural: {
    ocean: ["#1e5a7a", "#123a56", "#07111c"],
    oceanStroke: "#6a8aa0",
    land: {
      tropical: "#3d5c47",
      temperate: "#5c6d4e",
      boreal: "#3c4f48",
      ice: "#9aafb8",
      desert: "#8b734f",
    },
    landStroke: "#1e2a24",
    day: "#d8eef8",
    night: "#02060c",
    atmosphere: "#79c3cf",
  },
  jewel: {
    ocean: ["#1a6a8a", "#0c3a5c", "#061018"],
    oceanStroke: "#6ea3bb",
    land: {
      tropical: "#2d6a52",
      temperate: "#4d7a55",
      boreal: "#2a5550",
      ice: "#a8c0ca",
      desert: "#a7844a",
    },
    landStroke: "#163028",
    day: "#e4f4fb",
    night: "#02050a",
    atmosphere: "#79c3cf",
  },
};

export const GLOBE_LOOK: GlobeLook = "natural";

// cspell:words boreal
type Box = [number, number, number, number];

/** Dry belts as [west, south, east, north] in degrees, used for both tints and overlays. */
const DESERTS: Box[] = [
  [-17, 15, 32, 36],
  [32, 12, 60, 35],
  [55, 22, 78, 32],
  [75, 36, 110, 50],
  [112, -32, 150, -16],
  [-124, 25, -102, 42],
  [-73, -35, -63, -18],
  [12, -32, 28, -18],
];

const GREENLAND: Box = [-73, 59, -12, 83.7];

export function landTint(lon: number, lat: number): LandTint {
  const a = Math.abs(lat);
  if (a >= 66.5) return "ice";
  if (inside(GREENLAND, lon, lat)) return "ice";
  if (DESERTS.some((d) => inside(d, lon, lat))) return "desert";
  if (a < 15) return "tropical";
  if (a >= 50) return "boreal";
  return "temperate";
}

function inside([west, south, east, north]: Box, lon: number, lat: number): boolean {
  return lon >= west && lon <= east && lat >= south && lat <= north;
}

function band(south: number, north: number) {
  return geoGraticule().extent([[-180, south], [180, north]]).outline();
}

function box([west, south, east, north]: Box): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

function multi(polygons: GeoJSON.Polygon[]): GeoPermissibleObjects {
  return { type: "MultiPolygon", coordinates: polygons.map((p) => p.coordinates) };
}

/** Climate overlays, drawn over the temperate land fill, in order. */
export const LAND_OVERLAYS: { tint: LandTint; geometry: GeoPermissibleObjects }[] = [
  { tint: "tropical", geometry: band(-15, 15) },
  { tint: "boreal", geometry: multi([band(50, 66.5), band(-66.5, -50)]) },
  { tint: "ice", geometry: multi([band(66.5, 89.9), band(-89.9, -66.5), box(GREENLAND)]) },
  { tint: "desert", geometry: multi(DESERTS.map(box)) },
];
