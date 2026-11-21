import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { geoGraticule10, geoPath, type GeoPermissibleObjects } from "d3-geo";
import land from "@/data/globeLand.json";
import coordinates from "@/data/cityCoordinates.json";
import { globeCities, type Person } from "@/lib/peopleDiscovery";
import { CARD, CITY_ZOOM, MAX_ZOOM, clusterMarkers, isDoubleTap, pinchZoom, zoomToSplit, type GlobeMarker } from "@/lib/globeMarkers";
import { coastStep, flingVelocity, type RotationSample } from "@/lib/globeInertia";
import { cardName, cardTone, memberCount } from "@/lib/cityCard";
import { GLOBE_SIZE, GLOBE_SCALE, anchorRotation, globeProjection, pointAt, screenPoint, type Rotation } from "@/lib/globeView";
import { GLOBE_LOOK, GLOBE_PAINT, LAND_OVERLAYS } from "@/lib/globePaint";
import { detailClipAngle, limbOpacity, outwardReach, viewDot } from "@/lib/globeLimb";
import { layersForZoom, loadGlobeLayer, pickCityLabels, type GlobeLayers } from "@/lib/globeLod";

const POINTS = coordinates as Record<string, number[]>;
/** Degrees the globe turns per frame unit of finger travel, matching a grab at the centre of the globe. */
const DEG_PER_UNIT = 180 / Math.PI / GLOBE_SCALE;

function useReducedMotion() {
  const [reduce, setReduce] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduce;
}

/**
 * A city on the globe: a name card on a short stem, with the member count on its corner.
 * It shows the place, not anyone's face; tapping it opens who is there.
 */
const CityCard = memo(function CityCard({ id, cityKey, label, total, cities, active }: { id: string; cityKey: string; label: string; total: number; cities: number; active: boolean }) {
  const tone = cardTone(cityKey);
  const half = CARD.w / 2;
  const top = -(CARD.h + CARD.lift);
  const gradient = `${id}-card-${cityKey.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={tone.from} />
          <stop offset="1" stopColor={tone.to} />
        </linearGradient>
      </defs>
      <path d={`M-4 ${-CARD.lift - 0.5} L0 0 L4 ${-CARD.lift - 0.5} Z`} fill={active ? "#ff9fc8" : "#faf4ed"} />
      <rect x={-half - 1.5} y={top - 1.5} width={CARD.w + 3} height={CARD.h + 3} rx="10" fill={active ? "#ff9fc8" : "#faf4ed"} />
      <rect x={-half} y={top} width={CARD.w} height={CARD.h} rx="9" fill={`url(#${gradient})`} />
      {/* Darker lower band so the name always reads, whatever the card color. */}
      <path
        d={`M${-half} ${top + CARD.h * 0.55} H${half} V${top + CARD.h - 9} Q${half} ${top + CARD.h} ${half - 9} ${top + CARD.h} H${-half + 9} Q${-half} ${top + CARD.h} ${-half} ${top + CARD.h - 9} Z`}
        fill="#0b0b12"
        fillOpacity=".3"
      />
      <text x={-half + 5} y={top + CARD.h - 7} fill="#faf4ed" fontSize="8.4" fontWeight="700" letterSpacing=".1">
        {cardName(label)}
      </text>
      <text x={-half + 5} y={top + 12} fill="#faf4ed" fillOpacity=".85" fontSize="6.4" fontWeight="700" letterSpacing=".5">
        {cities > 1 ? `${cities} CITIES` : "MEMBERS"}
      </text>
      <g transform={`translate(${half - 2},${top + 2})`}>
        <circle r={CARD.badge} fill="#ff9fc8" stroke="#0b0b12" strokeWidth="1.2" />
        <text y="3.2" textAnchor="middle" fill="#1b1520" fontSize="9" fontWeight="700">
          {memberCount(total)}
        </text>
      </g>
      <circle data-card-anchor r="2.2" fill="#0b0b12" stroke={active ? "#ff9fc8" : "#faf4ed"} strokeWidth="1.2" />
    </g>
  );
});

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
  const [look, setLook] = useState<"natural" | "jewel">(GLOBE_LOOK);
  const view = useRef({ rotation, zoom });
  view.current = { rotation, zoom };
  const chosen = cities.find((city) => city.key === selected)?.point;
  const chosenLon = chosen?.[0];
  const chosenLat = chosen?.[1];
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("globeRot")) return;
    if (chosenLon !== undefined && chosenLat !== undefined)
      // Tilt a little on the whole globe for context; when zoomed in, centre exactly so the city stays in view.
      setRotation([-chosenLon, -chosenLat * (view.current.zoom > 1.5 ? 1 : 0.8)]);
  }, [chosenLon, chosenLat]);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const z = Number(q.get("globeZoom"));
    const rot = q.get("globeRot");
    const nextLook = q.get("globeLook");
    if (z >= 1 && z <= MAX_ZOOM) setZoom(z);
    if (rot) {
      const [a, b] = rot.split(",").map(Number);
      if (Number.isFinite(a) && Number.isFinite(b)) setRotation([a, b]);
    }
    if (nextLook === "jewel" || nextLook === "natural") setLook(nextLook);
  }, []);
  const id = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const reduceMotion = useReducedMotion();
  const paint = GLOBE_PAINT[look];
  const globeR = GLOBE_SCALE * zoom;
  const haloR = globeR + 22;
  const haloStart = Math.max(0, Math.min(1, (globeR / haloR) * 0.92));
  const [layers, setLayers] = useState<GlobeLayers>({});
  const wanted = layersForZoom(zoom).join(",");
  const movingRef = useRef(false);
  useEffect(() => {
    let live = true;
    // Delay so a first pinch or double-tap is not interrupted by parsing the detail layers.
    const start = window.setTimeout(() => {
      if (!live) return;
      for (const name of layersForZoom(zoom)) {
        loadGlobeLayer(name).then(
          (value) => {
            const tryApply = () => {
              if (!live) return;
              if (movingRef.current) {
                window.setTimeout(tryApply, 100);
                return;
              }
              setLayers((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }));
            };
            tryApply();
          },
          () => {}
        );
      }
    }, 2000);
    return () => {
      live = false;
      window.clearTimeout(start);
    };
  }, [wanted, zoom]);
  const projection = useMemo(() => globeProjection(rotation, zoom), [rotation, zoom]);
  const detail = useMemo(() => globeProjection(rotation, zoom).clipAngle(detailClipAngle(zoom)), [rotation, zoom]);
  // One decimal is a third of a device pixel on a phone, and cheaper to build than d3's default of three.
  const path = useMemo(() => geoPath(projection).digits(1), [projection]);
  const detailPath = useMemo(() => geoPath(detail).digits(1), [detail]);
  const borderDraw = detailPath;

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
  movingRef.current = moving;
  const suppressClick = useRef(false);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);
  const next = useRef<{ rotation: Rotation; zoom: number } | null>(null);
  const samples = useRef<RotationSample[]>([]);
  const coast = useRef<number | null>(null);
  const commit = useCallback((rotationNext: Rotation, zoomNext: number) => {
    next.current = { rotation: rotationNext, zoom: zoomNext };
    if (gesture.current?.kind === "pan") {
      samples.current.push({ t: performance.now(), rotation: rotationNext });
      if (samples.current.length > 8) samples.current.shift();
    }
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
    if (coast.current !== null) cancelAnimationFrame(coast.current);
  }, []);
  /** Stop a coasting globe. True when it was coasting, so the touch that stopped it is not a tap. */
  const stopCoast = () => {
    if (coast.current === null) return false;
    cancelAnimationFrame(coast.current);
    coast.current = null;
    return true;
  };
  /** After a flick the globe keeps turning and slows down, like a scroll view on iOS. */
  const startCoast = (): boolean => {
    const velocity = reduceMotion ? null : flingVelocity(samples.current, performance.now());
    samples.current = [];
    if (!velocity) return false;
    let v = velocity;
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(48, t - last);
      last = t;
      const at = view.current;
      const moved = coastStep(at.rotation, v, dt);
      v = moved.velocity;
      if (!moved.going) {
        coast.current = null;
        setMoving(false);
        return;
      }
      view.current = { rotation: moved.rotation, zoom: at.zoom };
      setRotation(moved.rotation);
      coast.current = requestAnimationFrame(step);
    };
    coast.current = requestAnimationFrame(step);
    return true;
  };
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
      if (coast.current !== null) {
        cancelAnimationFrame(coast.current);
        coast.current = null;
        setMoving(false);
      }
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
      // A flick hands over to coasting, which clears `moving` when it stops.
      if (!(g?.kind === "pan" && e.type === "pointerup" && startCoast())) setMoving(false);
    }
  };

  const visible = cities.flatMap((city) => {
    if (viewDot(city.point, rotation) <= 0) return [];
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
  // During a pinch or pan, keep the 110m land so frame rate stays high; swap detail back in when the fingers lift.
  const detailed = !moving ? (zoom >= 5.5 && layers.land10) || layers.land50 : null;
  const landGeom = (detailed || land) as GeoPermissibleObjects;
  const landDraw = detailed ? detailPath : path;
  // Projecting the land is most of a frame's work, and the fill, the outline and the overlay clip all
  // use the same outline: build it once per frame, not three times.
  const landD = useMemo(() => landDraw(landGeom) || "", [landDraw, landGeom]);
  const graticuleD = useMemo(() => (zoom < 2.4 ? path(geoGraticule10()) || "" : ""), [path, zoom]);
  const showStates = !moving && !!layers.states && zoom >= 3;
  const showRivers = !moving && !!layers.rivers && zoom >= 4.5;
  const showLakes = !moving && !!layers.lakes && zoom >= 2;
  const showLabels = !moving && !!layers.places;
  const showCountries = !moving && !!layers.countries;
  const showOverlays = !moving;
  // A cluster zooms in far enough to split. A single city zooms in on itself and opens it.
  const open = (marker: { key: string; cities: number; point: [number, number]; points: [number, number][] }) => {
    if (suppressClick.current) return;
    setRotation([-marker.point[0], -marker.point[1]]);
    if (marker.cities > 1 && zoom < MAX_ZOOM) setZoom(zoomToSplit(marker.points, zoom));
    else {
      setZoom((z) => Math.max(z, CITY_ZOOM));
      onSelect(marker.key);
    }
  };
  const meOpacity = me ? limbOpacity(viewDot(me.point, rotation), globeR, 8, 16) : 0;
  const dot = me && meOpacity > 0 ? projection(me.point) : null;
  const labels = showLabels && layers.places
    ? pickCityLabels(layers.places, zoom, (point) => {
        const xy = projection(point);
        return xy ? [xy[0], xy[1]] : null;
      }, rotation, globeR, markers)
    : [];
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
          // A finger on a coasting globe stops it; that touch is a stop, not a tap on what is under it.
          const stopped = stopCoast();
          if (pointers.current.size === 1) {
            suppressClick.current = stopped;
            if (stopped) lastTap.current = null;
            samples.current = [];
            gesture.current = { kind: "pending", start: at, at: e.timeStamp, onMarker: stopped || !!(e.target as Element).closest("[data-city-marker]") };
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
            const z = current().zoom;
            if (active.anchor) {
              const r = anchorRotation(active.anchor, at, z, current().rotation);
              // The grabbed place cannot follow a finger past the globe's edge or the tilt limit. Rather
              // than stopping dead there, keep turning at the same rate from where it got to.
              const xy = screenPoint(r, z, active.anchor);
              if (!xy || Math.hypot(xy[0] - at[0], xy[1] - at[1]) > 4) gesture.current = { kind: "pan", anchor: null, start: at, rotation: r };
              commit(r, z);
            } else {
              commit(
                [
                  active.rotation[0] + ((at[0] - active.start[0]) * DEG_PER_UNIT) / z,
                  Math.max(-80, Math.min(80, active.rotation[1] - ((at[1] - active.start[1]) * DEG_PER_UNIT) / z)),
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
          <radialGradient id={`${id}-sea`} cx="36%" cy="30%">
            <stop stopColor={paint.ocean[0]} />
            <stop offset=".55" stopColor={paint.ocean[1]} />
            <stop offset="1" stopColor={paint.ocean[2]} />
          </radialGradient>
          <radialGradient id={`${id}-halo`} cx="50%" cy="50%">
            <stop offset={Math.max(0, haloStart - 0.04)} stopColor={paint.atmosphere} stopOpacity="0" />
            <stop offset={haloStart} stopColor={paint.atmosphere} stopOpacity=".32" />
            <stop offset={Math.min(1, haloStart + 0.06)} stopColor="#ff9fc8" stopOpacity=".1" />
            <stop offset="1" stopColor={paint.atmosphere} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-day`} cx="34%" cy="28%">
            <stop offset="0" stopColor={paint.day} stopOpacity=".22" />
            <stop offset=".4" stopColor={paint.day} stopOpacity=".07" />
            <stop offset="1" stopColor={paint.day} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-night`} cx="78%" cy="72%">
            <stop offset="0" stopColor={paint.night} stopOpacity=".42" />
            <stop offset=".55" stopColor={paint.night} stopOpacity=".16" />
            <stop offset="1" stopColor={paint.night} stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${id}-disc`}>
            <circle cx="200" cy="200" r={globeR} />
          </clipPath>
          <clipPath id={`${id}-face`} clipPathUnits="objectBoundingBox">
            <circle cx=".5" cy=".5" r=".5" />
          </clipPath>
        </defs>
        <circle cx="200" cy="200" r={haloR} fill={`url(#${id}-halo)`} pointerEvents="none" />
        <path d={path({ type: "Sphere" }) || ""} fill={`url(#${id}-sea)`} stroke={paint.oceanStroke} strokeOpacity=".35" />
        {/* Second defs: land clip must come after the ocean path so tests can measure that path. */}
        {showOverlays && (
          <defs>
            <clipPath id={`${id}-land`}>
              <path d={landD} />
            </clipPath>
          </defs>
        )}
        <path d={landD} fill={paint.land.temperate} pointerEvents="none" />
        {showOverlays && (
          <g clipPath={`url(#${id}-land)`} pointerEvents="none">
            {LAND_OVERLAYS.map((overlay) => (
              <path key={overlay.tint} d={landDraw(overlay.geometry) || ""} fill={paint.land[overlay.tint]} />
            ))}
          </g>
        )}
        {showLakes && <path d={borderDraw(layers.lakes) || ""} fill={paint.ocean[1]} fillOpacity=".85" stroke="none" pointerEvents="none" />}
        <path d={landD} fill="none" stroke={paint.landStroke} strokeOpacity=".45" strokeWidth={zoom > 3 ? 0.5 : 0.35} pointerEvents="none" />
        {showCountries && (
          <path d={borderDraw(layers.countries) || ""} fill="none" stroke="#d8e4c8" strokeOpacity={zoom >= 3 ? 0.18 : 0.28} strokeWidth={zoom >= 3 ? 0.35 : 0.4} pointerEvents="none" />
        )}
        {showStates && (
          <path d={borderDraw(layers.states) || ""} fill="none" stroke="#f2efe6" strokeOpacity=".28" strokeWidth=".4" pointerEvents="none" />
        )}
        {showRivers && (
          <path d={borderDraw(layers.rivers) || ""} fill="none" stroke={paint.ocean[0]} strokeOpacity=".55" strokeWidth=".45" pointerEvents="none" />
        )}
        <g clipPath={`url(#${id}-disc)`} pointerEvents="none">
          <circle cx="200" cy="200" r={globeR} fill={`url(#${id}-day)`} />
          <circle cx="200" cy="200" r={globeR} fill={`url(#${id}-night)`} />
        </g>
        {graticuleD && (
          <path d={graticuleD} fill="none" stroke={paint.atmosphere} strokeOpacity=".07" strokeWidth=".5" pointerEvents="none" />
        )}
        {showLabels && labels.map((label) => (
          <g key={`${label.name}-${label.xy[0].toFixed(1)}`} transform={`translate(${label.xy[0]},${label.xy[1]})`} pointerEvents="none" aria-hidden>
            <circle r="1.7" fill="#faf4ed" stroke="#0b0b12" strokeWidth=".6" />
            <text y="10" textAnchor="middle" fill="#faf4ed" fontSize="6.5" fontWeight="600" stroke="#0b0b12" strokeWidth="2.2" paintOrder="stroke" strokeLinejoin="round">
              {label.name}
            </text>
          </g>
        ))}
        {dot && (
          <g transform={`translate(${dot[0]},${dot[1]})`} opacity={meOpacity} aria-label={me?.live ? `You, live in ${me.label}` : `You, ${me?.label}`}>
            {me?.live && (
              <circle r="9" fill="#79c3cf" opacity={reduceMotion ? ".4" : ".35"}>
                {!reduceMotion && (
                  <>
                    <animate attributeName="r" values="6;16;6" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values=".5;0;.5" dur="2.4s" repeatCount="indefinite" />
                  </>
                )}
              </circle>
            )}
            <circle r="5" fill={me?.live ? "#79c3cf" : "#faf4ed"} stroke="#0b0b12" strokeWidth="1.5" />
          </g>
        )}
        <g clipPath={`url(#${id}-disc)`}>
        {markers.map((city) => {
          const active = selected === city.key;
          const opacity = limbOpacity(viewDot(city.point, rotation), globeR, outwardReach(city.xy));
          if (opacity <= 0) return null;
          return (
            <g
              key={city.key}
              data-city-marker
              data-limb-opacity={opacity.toFixed(2)}
              transform={`translate(${city.xy[0]},${city.xy[1]})`}
              opacity={opacity}
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
              {/* Tap target: the whole card plus a margin, at least 44 px on a phone. */}
              <rect data-card-hit x={-CARD.w / 2 - 4} y={-(CARD.h + CARD.lift) - 6} width={CARD.w + 8} height={CARD.h + CARD.lift + 10} fill="transparent" />
              {city.liveTotal > 0 && (
                <rect
                  x={-CARD.w / 2 - 4} y={-(CARD.h + CARD.lift) - 4} width={CARD.w + 8} height={CARD.h + 8} rx="12"
                  fill="none" stroke="#79c3cf" strokeWidth="2" opacity={reduceMotion ? ".85" : undefined} pointerEvents="none"
                >
                  {!reduceMotion && <animate attributeName="opacity" values="1;.15;1" dur="2.4s" repeatCount="indefinite" />}
                </rect>
              )}
              <CityCard id={id} cityKey={city.key} label={city.label} total={city.total} cities={city.cities} active={active} />
              {city.cities > 1 && (
                <g transform="translate(0,9)" pointerEvents="none">
                  <rect x="-22" y="-1" width="44" height="13" rx="6.5" fill="#0b0b12" fillOpacity=".8" stroke="#faf4ed" strokeOpacity=".35" strokeWidth=".6" />
                  <text y="8.4" textAnchor="middle" fill="#faf4ed" fontSize="7.5" fontWeight="600">
                    Zoom in
                  </text>
                </g>
              )}
            </g>
          );
        })}
        </g>
      </svg>
      <div className="absolute bottom-1 right-1 flex gap-1" aria-label="Globe controls">
        {[
          ["Rotate globe west", "←", () => { if (stopCoast()) setMoving(false); setRotation((r) => [r[0] - 35, r[1]]); }],
          ["Rotate globe east", "→", () => { if (stopCoast()) setMoving(false); setRotation((r) => [r[0] + 35, r[1]]); }],
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
