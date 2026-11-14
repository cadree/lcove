/** Globe marker layout: fold overlapping cities, keep everyone's faces, and fan a group out. */
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

export function clusterMarkers(visible: PlacedCity[], selected: string | null, gap = 36): GlobeMarker[] {
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

/** Faces drawn stacked behind the main one: how many extra discs (0-2) a marker shows. */
export function stackDepth(total: number): number {
  return Math.max(0, Math.min(2, total - 1));
}

/** Positions for a fanned-out group: an arc above the marker, n slots. */
export function fanOffsets(n: number, radius = 36): [number, number][] {
  if (n <= 0) return [];
  const spread = Math.min(Math.PI * 0.9, (n - 1) * 0.5);
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1));
    return [Math.round(Math.cos(angle) * radius * 10) / 10, Math.round(Math.sin(angle) * radius * 10) / 10];
  });
}
