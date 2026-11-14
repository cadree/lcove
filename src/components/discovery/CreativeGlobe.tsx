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
import { resolveCity } from "@/lib/cities";
import { safeWebLink } from "@/lib/tripMoney";
import type { DiscoveryCity } from "@/lib/creativeDiscovery";

function cityCoordinates(city: DiscoveryCity): [number, number] | undefined {
  const points = coordinates as Record<string, number[]>;
  const point =
    points[city.city_key] || points[resolveCity(city.label).city_key];
  return point?.length === 2 ? [point[0], point[1]] : undefined;
}
export function CreativeGlobe({
  cities,
  onSelect,
  selected,
}: {
  cities: DiscoveryCity[];
  onSelect: (key: string) => void;
  selected: string | null;
}) {
  const [rotation, setRotation] = useState<[number, number]>([90, -20]);
  const [zoom, setZoom] = useState(1);
  const chosenCity = cities.find((city) => city.city_key === selected);
  const chosenPoint = chosenCity ? cityCoordinates(chosenCity) : undefined;
  const chosenLongitude = chosenPoint?.[0];
  const chosenLatitude = chosenPoint?.[1];
  useEffect(() => {
    if (chosenLongitude !== undefined && chosenLatitude !== undefined)
      setRotation([-chosenLongitude, -chosenLatitude]);
  }, [chosenLongitude, chosenLatitude]);
  const drag = useRef<{
    x: number;
    y: number;
    rotation: [number, number];
  } | null>(null);
  const id = useId().replace(/:/g, "");
  const projection = useMemo(
    () =>
      geoOrthographic()
        .rotate(rotation)
        .scale(173 * zoom)
        .translate([200, 198])
        .clipAngle(90),
    [rotation, zoom]
  );
  const path = geoPath(projection);
  const visible = cities.flatMap((city) => {
    const point = cityCoordinates(city);
    if (
      !point ||
      geoDistance(point, [-rotation[0], -rotation[1]]) > Math.PI / 2
    )
      return [];
    const xy = projection(point);
    return xy ? [{ ...city, xy }] : [];
  });
  // Keep marker hit areas apart; the complete list remains in the city rail.
  const occupied: number[][] = [];
  const markers = visible.filter((city) => {
    if (
      occupied.some(
        (p) => Math.hypot(p[0] - city.xy[0], p[1] - city.xy[1]) < 44
      )
    )
      return false;
    occupied.push(city.xy);
    return true;
  });
  return (
    <div
      className="relative -mx-4 overflow-hidden"
      aria-label="City discovery globe"
    >
      <svg
        viewBox="0 0 400 400"
        className="mx-auto block w-full max-w-[620px] touch-pan-y"
        role="img"
        aria-label="Rotatable globe showing opted-in creatives by city. Use the city cards below to select a location."
        onPointerDown={(e) => {
          if ((e.target as Element).closest("[data-city-marker]")) return;
          drag.current = { x: e.clientX, y: e.clientY, rotation };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const scale = 400 / e.currentTarget.getBoundingClientRect().width;
          setRotation([
            drag.current.rotation[0] +
              (e.clientX - drag.current.x) * scale * 0.4,
            Math.max(
              -70,
              Math.min(
                70,
                drag.current.rotation[1] -
                  (e.clientY - drag.current.y) * scale * 0.2
              )
            ),
          ]);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <defs>
          <radialGradient id={`${id}-sea`} cx="35%" cy="30%">
            <stop stopColor="#3d3940" />
            <stop offset=".8" stopColor="#191a23" />
            <stop offset="1" stopColor="#080b14" />
          </radialGradient>
          <radialGradient id={`${id}-halo`}>
            <stop offset=".7" stopColor="#b1a6b0" stopOpacity="0" />
            <stop offset=".87" stopColor="#b1a6b0" stopOpacity=".15" />
            <stop offset="1" stopColor="#b1a6b0" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="198" r="198" fill={`url(#${id}-halo)`} />
        <path
          d={path({ type: "Sphere" }) || ""}
          fill={`url(#${id}-sea)`}
          stroke="#8c858e"
          strokeOpacity=".25"
        />
        <path
          d={path(land as GeoPermissibleObjects) || ""}
          fill="#89828c"
          fillOpacity=".6"
          stroke="#b5aeb8"
          strokeWidth=".3"
        />
        <path
          d={path(geoGraticule10()) || ""}
          fill="none"
          stroke="#a29baa"
          strokeOpacity=".09"
          strokeWidth=".5"
        />
        {markers.map((city) => (
          <g
            key={city.city_key}
            data-city-marker
            transform={`translate(${city.xy[0]},${city.xy[1]})`}
            role="button"
            tabIndex={0}
            aria-label={`${city.label}, ${city.count} creatives`}
            onClick={() => onSelect(city.city_key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(city.city_key);
              }
            }}
            className="cursor-pointer outline-none focus:opacity-70"
          >
            <rect
              x="-23"
              y="-36"
              width="46"
              height="53"
              rx="9"
              fill="transparent"
            />
            <path d="M-5,10 L0,18 L5,10" fill="#e5d9d1" />
            <rect
              x="-17"
              y="-33"
              width="34"
              height="44"
              rx="7"
              fill={selected === city.city_key ? "#b8e6e7" : "#d7c4b5"}
              stroke="#fff"
              strokeWidth="1.5"
            />
            {safeWebLink(city.image) ? (
              <image
                href={safeWebLink(city.image)}
                x="-14"
                y="-30"
                width="28"
                height="38"
                preserveAspectRatio="xMidYMid slice"
              />
            ) : (
              <text y="-8" textAnchor="middle" fill="#3d3434" fontSize="13">
                {city.label.slice(0, 2).toUpperCase()}
              </text>
            )}
            <circle cx="16" cy="-31" r="12" fill="#faf4ed" />
            <text
              x="16"
              y="-27"
              fill="#504751"
              textAnchor="middle"
              fontSize="9"
            >
              {city.count > 99 ? "99+" : city.count}
            </text>
          </g>
        ))}
      </svg>
      <div
        className="absolute bottom-2 right-4 flex gap-1"
        aria-label="Globe controls"
      >
        <button
          className="h-11 w-11 rounded-full bg-white/10"
          aria-label="Rotate globe west"
          onClick={() => setRotation((r) => [r[0] - 35, r[1]])}
        >
          ←
        </button>
        <button
          className="h-11 w-11 rounded-full bg-white/10"
          aria-label="Rotate globe east"
          onClick={() => setRotation((r) => [r[0] + 35, r[1]])}
        >
          →
        </button>
        <button
          className="h-11 w-11 rounded-full bg-white/10"
          aria-label={zoom === 1 ? "Zoom in" : "Zoom out"}
          onClick={() => setZoom((z) => (z === 1 ? 1.5 : 1))}
        >
          {zoom === 1 ? "+" : "−"}
        </button>
      </div>
    </div>
  );
}
