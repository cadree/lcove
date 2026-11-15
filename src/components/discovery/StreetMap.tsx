// cspell:words maplibre maplibregl
import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { circleRing, distanceKm, type LonLat, type MapGroup } from "@/lib/nearbyMap";
import { safeWebLink } from "@/lib/tripMoney";

/**
 * OpenFreeMap's public instance: free, no key, no account, commercial use allowed, attribution
 * required (MapLibre shows it from the style). https://openfreemap.org/ and /tos/
 */
const STYLE = "https://tiles.openfreemap.org/styles/dark";
/** Street level, but never closer than a neighborhood: an area pin must not sit on one building. */
const MAX_ZOOM = 14.5;
const START_ZOOM = 11.6;
/** Radius of the soft halo drawn around a ~1 km area pin. */
const AREA_HALO_M = 650;
/** Pins this close to the centre are framed when the map opens. */
const FRAME_KM = 12;

function avatar(person: MapGroup["people"][number], size: number) {
  const el = document.createElement("span");
  el.className = "block overflow-hidden rounded-full ring-2 ring-[#0b0b12] bg-[#4a4150] text-[#faf4ed] font-bold text-center";
  el.style.width = el.style.height = `${size}px`;
  el.style.lineHeight = `${size}px`;
  el.style.fontSize = `${Math.round(size * 0.42)}px`;
  const photo = safeWebLink(person.avatar_url);
  if (photo) {
    const img = document.createElement("img");
    img.src = photo;
    img.alt = "";
    img.className = "h-full w-full object-cover";
    img.draggable = false;
    el.append(img);
  } else el.textContent = person.name.charAt(0).toUpperCase();
  return el;
}

/** A pin: stacked faces and a count. City-level groups say so, so nobody reads them as a street. */
function pinElement(group: MapGroup, onPick: (id: string) => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.mapPin = group.kind;
  const names = group.people.map((p) => p.name.split(" ")[0]);
  button.setAttribute(
    "aria-label",
    group.kind === "area"
      ? `${names.join(", ")}: around here (about 1 km)`
      : `${group.people.length} ${group.people.length === 1 ? "member" : "members"} in ${group.label}, city only`,
  );
  button.className = "flex min-h-11 items-center gap-1.5 rounded-full bg-[#1d1a22]/90 py-1 pl-1 pr-2.5 text-[11px] font-semibold text-[#faf4ed] shadow-[0_8px_24px_-8px_rgba(0,0,0,.9)] ring-1 backdrop-blur";
  button.classList.add(group.kind === "area" ? "ring-[#ff9fc8]/70" : "ring-white/25");
  const faces = document.createElement("span");
  faces.className = "flex -space-x-2";
  for (const person of group.people.slice(0, 3)) faces.append(avatar(person, 30));
  button.append(faces);
  const text = document.createElement("span");
  text.className = "whitespace-nowrap";
  text.textContent = group.kind === "area"
    ? group.people.length > 1 ? `${group.people.length} around here` : names[0]
    : `${group.people.length} in ${group.label.split(",")[0]}`;
  button.append(text);
  if (group.kind === "city") {
    const note = document.createElement("span");
    note.className = "whitespace-nowrap text-[9px] font-normal uppercase tracking-[.14em] text-white/55";
    note.textContent = "city";
    button.append(note);
  }
  // Pins are taps, not drags: let a drag that starts on a pin still move the map.
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    onPick(group.people[0].user_id);
  });
  return button;
}

function meElement(live: boolean) {
  const el = document.createElement("span");
  el.setAttribute("aria-label", live ? "You, about here" : "You, in your city");
  el.className = "relative block h-4 w-4 rounded-full border-2 border-[#0b0b12]";
  el.style.background = live ? "#79c3cf" : "#faf4ed";
  el.style.boxShadow = live ? "0 0 0 6px rgba(121,195,207,.28)" : "0 0 0 5px rgba(250,244,237,.18)";
  return el;
}

/**
 * Nearby: a dark street map of the viewer's city with members at area or city level.
 * One finger pans, two fingers pinch; the map owns every touch on it, like the globe.
 */
export function StreetMap({
  center,
  groups,
  me,
  onPick,
}: {
  center: LonLat;
  groups: MapGroup[];
  me: { point: LonLat; live: boolean } | null;
  onPick: (userId: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let instance: MapLibreMap;
    try {
      instance = new maplibregl.Map({
        container: el,
        style: STYLE,
        center,
        zoom: START_ZOOM,
        minZoom: 3,
        maxZoom: MAX_ZOOM,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: { compact: true },
        // Keep the drawing buffer small on phones; the map is decoration around people.
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      });
    } catch {
      setFailed(true);
      return;
    }
    instance.touchZoomRotate.disableRotation();
    instance.keyboard.disableRotation();
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    // Same idea as the globe's data-zoom: gesture checks read where the map is.
    const report = () => {
      const c = instance.getCenter();
      el.dataset.zoom = instance.getZoom().toFixed(3);
      el.dataset.center = `${c.lng.toFixed(5)},${c.lat.toFixed(5)}`;
    };
    instance.on("move", report);
    instance.on("load", () => {
      report();
      instance.addSource("areas", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      instance.addLayer({ id: "area-fill", type: "fill", source: "areas", paint: { "fill-color": "#ff9fc8", "fill-opacity": 0.16 } });
      instance.addLayer({ id: "area-line", type: "line", source: "areas", paint: { "line-color": "#ff9fc8", "line-opacity": 0.55, "line-width": 1.2 } });
      // MapLibre opens the compact credit on load; keep it as the (i) button so it does not cover
      // the map. It is still one tap away, as OpenFreeMap and OpenStreetMap ask.
      el.querySelector(".maplibregl-ctrl-attrib.maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
      setReady(true);
    });
    instance.on("error", (e) => {
      // A missing tile is harmless; only a style that never loads means there is no map.
      if (!instance.isStyleLoaded() && /style/i.test(String(e.error?.message || ""))) setFailed(true);
    });
    // iOS WebKit pinch-zooms the page through gesture events even with touch-action: none.
    // cspell:words gesturestart gesturechange
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener("gesturestart", stop, { passive: false });
    el.addEventListener("gesturechange", stop, { passive: false });
    map.current = instance;
    return () => {
      el.removeEventListener("gesturestart", stop);
      el.removeEventListener("gesturechange", stop);
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      instance.remove();
      map.current = null;
    };
    // The map is created once; centre changes fly below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [lon, lat] = center;
  useEffect(() => {
    map.current?.flyTo({ center: [lon, lat], zoom: Math.max(START_ZOOM, map.current.getZoom()), essential: false });
  }, [lon, lat]);

  // First time the pins arrive, frame the ones in the city itself (a suburb 30 km out should not
  // zoom the map out past street level; it is a short drag away).
  const framed = useRef(false);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || framed.current || !groups.length) return;
    framed.current = true;
    const bounds = new maplibregl.LngLatBounds(center, center);
    for (const g of groups) if (distanceKm(center, g.point) <= FRAME_KM) bounds.extend(g.point);
    instance.fitBounds(bounds, { padding: { top: 70, bottom: 50, left: 70, right: 70 }, maxZoom: 13, duration: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- framing is a one-off
  }, [groups, ready]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;
    markers.current.forEach((m) => m.remove());
    markers.current = groups.map((group) =>
      new maplibregl.Marker({ element: pinElement(group, (id) => pick.current(id)), anchor: "bottom" }).setLngLat(group.point).addTo(instance),
    );
    if (me) markers.current.push(new maplibregl.Marker({ element: meElement(me.live) }).setLngLat(me.point).addTo(instance));
    const halos = groups.filter((g) => g.kind === "area").map((g) => ({
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Polygon" as const, coordinates: [circleRing(g.point, AREA_HALO_M)] },
    }));
    (instance.getSource("areas") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: halos });
  }, [groups, me, ready]);

  return (
    <div
      className={[
        "relative h-[min(420px,52dvh)] w-full overflow-hidden rounded-[24px] bg-[#121016] ring-1 ring-white/10",
        // MapLibre's controls are white by default; match the dark map.
        "[&_.maplibregl-ctrl-group]:!bg-[#1d1a22]/90 [&_.maplibregl-ctrl-group]:!shadow-none [&_.maplibregl-ctrl-group]:ring-1 [&_.maplibregl-ctrl-group]:ring-white/15",
        "[&_.maplibregl-ctrl-group_button+button]:!border-white/10 [&_.maplibregl-ctrl-icon]:invert",
        "[&_.maplibregl-ctrl-attrib]:!bg-[#1d1a22]/85 [&_.maplibregl-ctrl-attrib]:!text-white/70 [&_.maplibregl-ctrl-attrib_a]:!text-white/80 [&_.maplibregl-ctrl-attrib-button]:invert",
      ].join(" ")}
    >
      <div ref={box} className="h-full w-full" data-street-map data-ready={ready ? "1" : "0"} aria-label="Street map of members nearby" role="region" />
      {!ready && !failed && <div className="absolute inset-0 animate-pulse bg-white/5" role="status" aria-label="Loading map" />}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/70" role="alert">
          The street map did not load. Members nearby are still listed below.
        </div>
      )}
    </div>
  );
}

export default StreetMap;
