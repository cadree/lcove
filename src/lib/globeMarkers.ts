/** Globe marker layout: one card per city, and cities whose cards would overlap fold into one. */
export interface PlacedCity {
  key: string;
  label: string;
  count: number;
  live: number;
  avatars: string[];
  point: [number, number];
  xy: [number, number];
}

export interface GlobeMarker extends PlacedCity {
  /** How many cities folded into this marker. */
  cities: number;
  total: number;
  liveTotal: number;
  /** Faces across every folded city, most-populated city first. */
  faces: string[];
  /** Every folded city's [lon, lat], lead city first. */
  points: [number, number][];
}

export const MAX_ZOOM = 12;

/** How far to zoom so a cluster's cities pull apart (or as far as the globe goes). */
export function zoomToSplit(points: [number, number][], current: number, gap = 36, scale = 178): number {
  const rad = Math.PI / 180;
  let nearest = Infinity;
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const [a, b] = [points[i], points[j]];
      const d = Math.hypot((a[0] - b[0]) * Math.cos(((a[1] + b[1]) / 2) * rad), a[1] - b[1]) * rad;
      if (d > 0) nearest = Math.min(nearest, d);
    }
  const needed = Number.isFinite(nearest) ? (gap * 1.25) / (scale * nearest) : current * 2;
  return Math.min(MAX_ZOOM, Math.max(current * 1.6, needed));
}

export const MAX_FACES = 5;

/** City card geometry in globe units (the globe is drawn in a 400 x 400 frame). */
export const CARD = { w: 50, h: 46, lift: 6, badge: 9 } as const;
/** Anchors closer than this would make two cards overlap, so they fold into one. */
export const CARD_GAP = 54;
/** Zoom a tapped city card opens to: close enough to read the region around it. */
export const CITY_ZOOM = 5;

export function clusterMarkers(visible: PlacedCity[], selected: string | null, gap = CARD_GAP): GlobeMarker[] {
  const markers: GlobeMarker[] = [];
  const order = [...visible].sort(
    (a, b) => Number(b.key === selected) - Number(a.key === selected) || b.count - a.count || a.key.localeCompare(b.key)
  );
  for (const city of order) {
    const near = markers.find((m) => Math.hypot(m.xy[0] - city.xy[0], m.xy[1] - city.xy[1]) < gap);
    if (near) {
      near.cities++;
      near.total += city.count;
      near.liveTotal += city.live;
      near.points.push(city.point);
      for (const face of city.avatars) if (near.faces.length < MAX_FACES && !near.faces.includes(face)) near.faces.push(face);
    } else
      markers.push({ ...city, cities: 1, total: city.count, liveTotal: city.live, faces: city.avatars.slice(0, MAX_FACES), points: [city.point] });
  }
  return markers;
}

/** Pinch: the new zoom from the finger spread, clamped to the globe's range. */
export function pinchZoom(startZoom: number, startDistance: number, distance: number, min = 1, max = MAX_ZOOM): number {
  if (!(startDistance > 0) || !(distance > 0)) return startZoom;
  return Math.min(max, Math.max(min, startZoom * (distance / startDistance)));
}

/** Two taps close together in time and place. */
export function isDoubleTap(
  previous: { t: number; x: number; y: number } | null,
  next: { t: number; x: number; y: number },
  ms = 320,
  px = 30
): boolean {
  return !!previous && next.t - previous.t <= ms && Math.hypot(next.x - previous.x, next.y - previous.y) <= px;
}
