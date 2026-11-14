import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { geoDistance, geoGraticule10, geoPath, type GeoPermissibleObjects } from "d3-geo";
import land from "@/data/globeLand.json";
import coordinates from "@/data/cityCoordinates.json";
import { safeWebLink } from "@/lib/tripMoney";
import { globeCities, type Person } from "@/lib/peopleDiscovery";
import { MAX_ZOOM, clusterMarkers, fanOffsets, isDoubleTap, pinchZoom, stackDepth, zoomToSplit, type GlobeMarker } from "@/lib/globeMarkers";
import { GLOBE_SIZE, anchorRotation, globeProjection, pointAt, screenPoint, type Rotation } from "@/lib/globeView";

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
  const slots = fanOffsets(shown.length + (extra > 0 ? 1 : 0));
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
  const [rotation, setRotation] = useState<Rotation>(() =>
    me ? [-me.point[0], -me.point[1] * 0.6] : [80, -25]
  );
  const [zoom, setZoom] = useState(1);
  const view = useRef({ rotation, zoom });
  view.current = { rotation, zoom };
  const chosen = cities.find((city) => city.key === selected)?.point;
  const chosenLon = chosen?.[0];
  const chosenLat = chosen?.[1];
  useEffect(() => {
    if (chosenLon !== undefined && chosenLat !== undefined)
      // Tilt a little on the whole globe for context; when zoomed in, centre exactly so the city stays in view.
      setRotation([-chosenLon, -chosenLat * (view.current.zoom > 1.5 ? 1 : 0.8)]);
  }, [chosenLon, chosenLat]);
  const id = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const projection = useMemo(() => globeProjection(rotation, zoom), [rotation, zoom]);
  const path = geoPath(projection);
  const facing = (point: [number, number]) =>
    geoDistance(point, [-rotation[0], -rotation[1]]) <= Math.PI / 2;

  // Gestures. Every finger is tracked; one finger grabs and turns the globe, two fingers pinch
  // around their midpoint. State changes are batched to one per animation frame, and markers
  // only regroup when the gesture ends so they never jump around under the fingers.
  const pointers = useRef(new Map<number, [number, number]>());
  const gesture = useRef<
    | { kind: "pending"; start: [number, number]; at: number; onMarker: boolean }
    | { kind: "pan"; anchor: [number, number] | null; start: [number, number]; rotation: Rotation }
    | { kind: "pinch"; distance: number; zoom: number; anchor: [number, number] | null; rotation: Rotation }
    | null
  >(null);
  const [moving, setMoving] = useState(false);
  const suppressClick = useRef(false);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);
  const next = useRef<{ rotation: Rotation; zoom: number } | null>(null);
  const commit = useCallback((rotationNext: Rotation, zoomNext: number) => {
    next.current = { rotation: rotationNext, zoom: zoomNext };
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const v = next.current;
      next.current = null;
      if (!v) return;
      view.current = v;
      setRotation(v.rotation);
      setZoom(v.zoom);
    });
  }, []);
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);
  const local = (clientX: number, clientY: number): [number, number] => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || !box.width) return [clientX, clientY];
    return [((clientX - box.left) * GLOBE_SIZE) / box.width, ((clientY - box.top) * GLOBE_SIZE) / box.height];
  };
  const current = () => next.current ?? view.current;
  // Capture only once a drag or pinch starts, so a plain tap still lands on the marker under it.
  // Captured fingers keep steering the globe when they slide off its edge.
  const capture = () => {
    for (const pointerId of pointers.current.keys()) {
      try {
        svgRef.current?.setPointerCapture(pointerId);
      } catch {
        /* that finger is already gone */
      }
    }
  };
  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const v = current();
    gesture.current = { kind: "pinch", distance: Math.hypot(a[0] - b[0], a[1] - b[1]), zoom: v.zoom, anchor: pointAt(v.rotation, v.zoom, mid), rotation: v.rotation };
    suppressClick.current = true;
    capture();
    setMoving(true);
  };
  const startPan = (at: [number, number]) => {
    const v = current();
    gesture.current = { kind: "pan", anchor: pointAt(v.rotation, v.zoom, at), start: at, rotation: v.rotation };
    suppressClick.current = true;
    capture();
    setMoving(true);
  };
  /** Zoom by a factor around a point of the frame, for double-tap, ctrl+wheel and the buttons. */
  const zoomAround = useCallback(
    (factor: number, at: [number, number]) => {
      const v = next.current ?? view.current;
      const z = Math.min(MAX_ZOOM, Math.max(1, v.zoom * factor));
      const anchor = pointAt(v.rotation, v.zoom, at);
      commit(anchor ? anchorRotation(anchor, at, z, v.rotation) : v.rotation, z);
    },
    [commit]
  );
  // iOS Safari and the Capacitor WebView pinch-zoom the whole page through their own gesture
  // events and non-cancelled touch moves; touch-action alone is not always enough there.
  // cspell:words gesturestart gesturechange
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const stop = (e: Event) => e.preventDefault();
    const touchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    const wheel = (e: WheelEvent) => {
      // A touchpad pinch arrives as ctrl+wheel. A plain wheel still scrolls the page.
      if (!e.ctrlKey) return;
      e.preventDefault();
      const box = svg.getBoundingClientRect();
      zoomAround(Math.exp(-e.deltaY * 0.01), [((e.clientX - box.left) * GLOBE_SIZE) / box.width, ((e.clientY - box.top) * GLOBE_SIZE) / box.height]);
    };
    svg.addEventListener("gesturestart", stop, { passive: false });
    svg.addEventListener("gesturechange", stop, { passive: false });
    svg.addEventListener("touchmove", touchMove, { passive: false });
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => {
      svg.removeEventListener("gesturestart", stop);
      svg.removeEventListener("gesturechange", stop);
      svg.removeEventListener("touchmove", touchMove);
      svg.removeEventListener("wheel", wheel);
    };
  }, [zoomAround]);
  const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (g?.kind === "pending" && e.type === "pointerup") {
      const at = local(e.clientX, e.clientY);
      const tap = { t: e.timeStamp, x: at[0], y: at[1] };
      if (!g.onMarker && isDoubleTap(lastTap.current, tap)) {
        lastTap.current = null;
        zoomAround(2, at);
      } else lastTap.current = g.onMarker ? null : tap;
    }
    if (pointers.current.size === 2) startPinch();
    else if (pointers.current.size === 1) startPan([...pointers.current.values()][0]);
    else {
      gesture.current = null;
      setMoving(false);
    }
  };

  const visible = cities.flatMap((city) => {
    if (!facing(city.point)) return [];
    const xy = projection(city.point);
    return xy ? [{ ...city, xy }] : [];
  });
  // Nearby cities that would overlap fold into the biggest one; tapping a cluster zooms in.
  // While a gesture runs, the groups from its start just follow the globe (no regrouping).
  const settled = useRef<GlobeMarker[]>([]);
  const markers: GlobeMarker[] = moving
    ? settled.current.flatMap((m) => {
        const xy = screenPoint(rotation, zoom, m.point);
        return xy ? [{ ...m, xy }] : [];
      })
    : clusterMarkers(visible, selected);
  if (!moving) settled.current = markers;
  // A cluster zooms in far enough to split; at full zoom it opens its biggest city and fans its faces out.
  const open = (marker: { key: string; cities: number; point: [number, number]; points: [number, number][] }) => {
    if (suppressClick.current) return;
    if (marker.cities > 1 && zoom < MAX_ZOOM) {
      setRotation([-marker.point[0], -marker.point[1]]);
      setZoom(zoomToSplit(marker.points, zoom));
    } else onSelect(marker.key);
  };
  const dot = me && facing(me.point) ? projection(me.point) : null;
  return (
    <div className="relative" aria-label="People globe">
      <svg
        ref={svgRef}
        viewBox="0 0 400 400"
        className="mx-auto block w-full max-w-[520px] select-none"
        // The globe owns every touch on it: no page pinch-zoom, no page scroll, no callout.
        style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
        data-zoom={zoom.toFixed(3)}
        data-rotation={`${rotation[0].toFixed(3)},${rotation[1].toFixed(3)}`}
        data-gesture={moving ? "active" : "idle"}
        role="img"
        aria-label={`Globe of members by city. ${cities.length} cities shown. Use the city picker to choose one.`}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          const at = local(e.clientX, e.clientY);
          pointers.current.set(e.pointerId, at);
          if (pointers.current.size === 1) {
            suppressClick.current = false;
            gesture.current = { kind: "pending", start: at, at: e.timeStamp, onMarker: !!(e.target as Element).closest("[data-city-marker]") };
          } else if (pointers.current.size === 2) startPinch();
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          const at = local(e.clientX, e.clientY);
          pointers.current.set(e.pointerId, at);
          const g = gesture.current;
          if (!g) return;
          if (g.kind === "pending") {
            // A few pixels of finger wobble is still a tap.
            if (Math.hypot(at[0] - g.start[0], at[1] - g.start[1]) > 6) startPan(g.start);
            else return;
          }
          const active = gesture.current;
          if (active?.kind === "pan") {
            if (active.anchor) commit(anchorRotation(active.anchor, at, current().zoom, current().rotation), current().zoom);
            else {
              const z = current().zoom;
              commit(
                [
                  active.rotation[0] + ((at[0] - active.start[0]) * 0.4) / z,
                  Math.max(-80, Math.min(80, active.rotation[1] - ((at[1] - active.start[1]) * 0.4) / z)),
                ],
                z
              );
            }
          } else if (active?.kind === "pinch" && pointers.current.size >= 2) {
            const [a, b] = [...pointers.current.values()];
            const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            const z = pinchZoom(active.zoom, active.distance, Math.hypot(a[0] - b[0], a[1] - b[1]));
            commit(active.anchor ? anchorRotation(active.anchor, mid, z, current().rotation) : current().rotation, z);
          }
        }}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onLostPointerCapture={(e) => {
          // Touch pointers start implicitly captured by the child under the finger (a land path, a
          // marker). Moving that capture to the svg fires lostpointercapture on the child, and it
          // bubbles here; only the svg itself losing a finger ends it.
          if (e.target === e.currentTarget && pointers.current.has(e.pointerId)) endPointer(e);
        }}
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
              {!(active && city.total > 1) && [2, 1].filter((n) => n <= stackDepth(city.total)).map((n) => (
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
          ["Zoom in", "+", () => zoomAround(1.6, [GLOBE_SIZE / 2, GLOBE_SIZE / 2])],
          ["Zoom out", "−", () => zoomAround(1 / 1.6, [GLOBE_SIZE / 2, GLOBE_SIZE / 2])],
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
