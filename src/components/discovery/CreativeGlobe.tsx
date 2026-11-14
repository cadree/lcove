import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  geoDistance,
  geoGraticule10,
  geoOrthographic,
  geoPath,
  type GeoPermissibleObjects,
} from "d3-geo";
import land from "@/data/globeLand.json";
import coordinates from "@/data/cityCoordinates.json";
import { safeWebLink } from "@/lib/tripMoney";
import { globeCities, type Person } from "@/lib/peopleDiscovery";
import { MAX_ZOOM, clusterMarkers, fanOffsets, stackDepth, zoomToSplit } from "@/lib/globeMarkers";

const POINTS = coordinates as Record<string, number[]>;

/** Initials for a marker without photos. */
function monogram(label: string) {
  return label.split(",")[0].slice(0, 2).toUpperCase();
}

/** One round face on the globe: a photo when there is a safe one, otherwise initials. */
function Face({ clip, href, label, x = 0, y = 0, r, dim }: { clip: string; href?: string; label: string; x?: number; y?: number; r: number; dim?: boolean }) {
  const photo = safeWebLink(href);
  return (
    <g transform={`translate(${x},${y})`} opacity={dim ? 0.92 : 1} pointerEvents="none">
      <circle r={r + 1.5} fill="#0b0b12" />
      <circle r={r} fill={dim ? "#433a48" : "#5d5262"} />
      {photo ? (
        <image href={photo} x={-r} y={-r} width={r * 2} height={r * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} />
      ) : (
        !dim && (
          <text y={r * 0.27} textAnchor="middle" fill="#faf4ed" fontSize={r * 0.67} fontWeight="700">
            {monogram(label)}
          </text>
        )
      )}
    </g>
  );
}

/** The selected group fans its faces out above the marker so it is obvious several people are there. */
function Fan({ clip, faces, total, label }: { clip: string; faces: string[]; total: number; label: string }) {
  const shown = faces.slice(0, 4);
  const extra = total - shown.length;
  const slots = fanOffsets(shown.length + (extra > 0 ? 1 : 0), 40);
  return (
    <g pointerEvents="none" aria-hidden>
      {shown.map((face, i) => (
        <Face key={face} clip={clip} href={face} label={label} x={slots[i][0]} y={slots[i][1]} r={10} />
      ))}
      {extra > 0 && (
        <g transform={`translate(${slots[shown.length][0]},${slots[shown.length][1]})`}>
          <circle r="11.5" fill="#0b0b12" />
          <circle r="10" fill="#ff9fc8" />
          <text y="3" textAnchor="middle" fill="#1b1520" fontSize="8" fontWeight="700">
            +{extra > 99 ? "99" : extra}
          </text>
        </g>
      )}
    </g>
  );
}

export function CreativeGlobe({
  people,
  onSelect,
  selected,
  me: mine,
}: {
  people: Person[];
  onSelect: (key: string) => void;
  selected: string | null;
  /** The viewer's own city. Live means they opted in to sharing a live city. */
  me?: { key: string; live: boolean; label: string } | null;
}) {
  const cities = useMemo(() => globeCities(people, POINTS), [people]);
  const myPoint = mine ? POINTS[mine.key] : undefined;
  const me = mine && myPoint?.length === 2 ? { ...mine, point: [myPoint[0], myPoint[1]] as [number, number] } : null;
  const [rotation, setRotation] = useState<[number, number]>(() =>
    me ? [-me.point[0], -me.point[1] * 0.6] : [80, -25]
  );
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const chosen = cities.find((city) => city.key === selected)?.point;
  const chosenLon = chosen?.[0];
  const chosenLat = chosen?.[1];
  useEffect(() => {
    if (chosenLon !== undefined && chosenLat !== undefined)
      // Tilt a little on the whole globe for context; when zoomed in, centre exactly so the city stays in view.
      setRotation([-chosenLon, -chosenLat * (zoomRef.current > 1.5 ? 1 : 0.8)]);
  }, [chosenLon, chosenLat]);
  const drag = useRef<{ x: number; y: number; rotation: [number, number] } | null>(null);
  const id = useId().replace(/:/g, "");
  const projection = useMemo(
    () =>
      geoOrthographic()
        .rotate(rotation)
        .scale(178 * zoom)
        .translate([200, 200])
        .clipAngle(90),
    [rotation, zoom]
  );
  const path = geoPath(projection);
  const facing = (point: [number, number]) =>
    geoDistance(point, [-rotation[0], -rotation[1]]) <= Math.PI / 2;
  const visible = cities.flatMap((city) => {
    if (!facing(city.point)) return [];
    const xy = projection(city.point);
    return xy ? [{ ...city, xy }] : [];
  });
  // Nearby cities that would overlap fold into the biggest one; tapping a cluster zooms in.
  const markers = clusterMarkers(visible, selected);
  // A cluster zooms in far enough to split; at full zoom it opens its biggest city and fans its faces out.
  const open = (marker: { key: string; cities: number; point: [number, number]; points: [number, number][] }) => {
    if (marker.cities > 1 && zoom < MAX_ZOOM) {
      setRotation([-marker.point[0], -marker.point[1]]);
      setZoom(zoomToSplit(marker.points, zoom));
    } else onSelect(marker.key);
  };
  const dot = me && facing(me.point) ? projection(me.point) : null;
  return (
    <div className="relative" aria-label="People globe">
      <svg
        viewBox="0 0 400 400"
        className="mx-auto block w-full max-w-[520px] touch-pan-y select-none"
        role="img"
        aria-label={`Globe of members by city. ${cities.length} cities shown. Use the city picker to choose one.`}
        onPointerDown={(e) => {
          if ((e.target as Element).closest("[data-city-marker]")) return;
          drag.current = { x: e.clientX, y: e.clientY, rotation };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const scale = 400 / e.currentTarget.getBoundingClientRect().width;
          setRotation([
            drag.current.rotation[0] + (e.clientX - drag.current.x) * scale * 0.4,
            Math.max(-70, Math.min(70, drag.current.rotation[1] - (e.clientY - drag.current.y) * scale * 0.2)),
          ]);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <defs>
          <radialGradient id={`${id}-sea`} cx="38%" cy="32%">
            <stop stopColor="#3b3542" />
            <stop offset=".75" stopColor="#1a1822" />
            <stop offset="1" stopColor="#0b0b12" />
          </radialGradient>
          <radialGradient id={`${id}-halo`}>
            <stop offset=".78" stopColor="#ff9fc8" stopOpacity="0" />
            <stop offset=".9" stopColor="#79c3cf" stopOpacity=".16" />
            <stop offset="1" stopColor="#79c3cf" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${id}-face`} clipPathUnits="objectBoundingBox">
            <circle cx=".5" cy=".5" r=".5" />
          </clipPath>
        </defs>
        <circle cx="200" cy="200" r="200" fill={`url(#${id}-halo)`} />
        <path d={path({ type: "Sphere" }) || ""} fill={`url(#${id}-sea)`} stroke="#8c858e" strokeOpacity=".25" />
        <path d={path(land as GeoPermissibleObjects) || ""} fill="#8b8390" fillOpacity=".55" stroke="#b5aeb8" strokeWidth=".3" />
        <path d={path(geoGraticule10()) || ""} fill="none" stroke="#a29baa" strokeOpacity=".08" strokeWidth=".5" />
        {dot && (
          <g transform={`translate(${dot[0]},${dot[1]})`} aria-label={me?.live ? `You, live in ${me.label}` : `You, ${me?.label}`}>
            {me?.live && (
              <circle r="9" fill="#79c3cf" opacity=".35">
                <animate attributeName="r" values="6;16;6" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values=".5;0;.5" dur="2.4s" repeatCount="indefinite" />
              </circle>
            )}
            <circle r="5" fill={me?.live ? "#79c3cf" : "#faf4ed"} stroke="#0b0b12" strokeWidth="1.5" />
          </g>
        )}
        {markers.map((city) => {
          const active = selected === city.key;
          return (
            <g
              key={city.key}
              data-city-marker
              transform={`translate(${city.xy[0]},${city.xy[1]})`}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={
                city.cities > 1
                  ? `${city.label} and ${city.cities - 1} nearby ${city.cities === 2 ? "city" : "cities"}: ${city.total} members. Zoom in`
                  : `${city.label}: ${city.count} ${city.count === 1 ? "member" : "members"}${city.live ? `, ${city.live} here live` : ""}`
              }
              onClick={() => open(city)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  open(city);
                }
              }}
              className="cursor-pointer outline-none"
            >
              <circle r="22" fill="transparent" />
              {city.liveTotal > 0 && (
                <circle r="18" fill="none" stroke="#79c3cf" strokeWidth="2">
                  <animate attributeName="r" values="17;23;17" dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0;1" dur="2.4s" repeatCount="indefinite" />
                </circle>
              )}
              {/* A group reads as a group: up to two faces stacked behind the front one. */}
              {[2, 1].filter((n) => n <= stackDepth(city.total)).map((n) => (
                <Face key={n} clip={`${id}-face`} href={city.faces[n]} label={city.label} x={n === 1 ? -13 : 13} y={4} r={11.5} dim />
              ))}
              <circle r="17" fill={active ? "#ff9fc8" : "#faf4ed"} />
              <Face clip={`${id}-face`} href={city.faces[0]} label={city.label} r={15} />
              {city.cities > 1 && (
                <g transform="translate(0,26)">
                  <rect x="-22" y="-7" width="44" height="13" rx="6.5" fill="#0b0b12" fillOpacity=".8" stroke="#faf4ed" strokeOpacity=".35" strokeWidth=".6" />
                  <text y="2.6" textAnchor="middle" fill="#faf4ed" fontSize="7.5" fontWeight="600">
                    {city.cities} cities
                  </text>
                </g>
              )}
              {active && city.total > 1 && <Fan clip={`${id}-face`} faces={city.faces} total={city.total} label={city.label} />}
              <g transform="translate(13,-13)">
                <circle r="8.5" fill="#ff9fc8" stroke="#0b0b12" strokeWidth="1.2" />
                <text y="3" textAnchor="middle" fill="#1b1520" fontSize="8.5" fontWeight="700">
                  {city.total > 99 ? "99+" : city.total}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-1 right-1 flex gap-1" aria-label="Globe controls">
        {[
          ["Rotate globe west", "←", () => setRotation((r) => [r[0] - 35, r[1]])],
          ["Rotate globe east", "→", () => setRotation((r) => [r[0] + 35, r[1]])],
          ["Zoom in", "+", () => setZoom((z) => Math.min(MAX_ZOOM, z * 1.6))],
          ["Zoom out", "−", () => setZoom((z) => Math.max(1, z / 1.6))],
        ].map(([label, glyph, run]) => (
          <button
            key={label as string}
            type="button"
            className="h-11 w-11 rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
            aria-label={label as string}
            onClick={run as () => void}
          >
            {glyph as string}
          </button>
        ))}
      </div>
    </div>
  );
}
