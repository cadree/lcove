import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AREA_STEP, NEARBY_KM, circleRing, coarsen, distanceKm, nearbyGroups, safeArea, type LonLat } from "./nearbyMap.ts";
import { buildPeople, type DiscoverySignal, type Member } from "./peopleDiscovery.ts";

const coordinates = JSON.parse(readFileSync("src/data/cityCoordinates.json", "utf8")) as Record<string, number[]>;
const member = (id: string, key: string): Member => ({
  user_id: id, display_name: id, avatar_url: null, bio: null, city: null, city_display: null,
  city_key: key, created_at: null, skills: [], passions: [],
});
const signal = (id: string, extra: Partial<DiscoverySignal> = {}): DiscoverySignal => ({
  user_id: id, liked: null, live_city_key: null, live_until: null, trip: null, ...extra,
});
const decimals = (n: number) => (String(n).split(".")[1] || "").length;

test("coarsen snaps a device position to the ~1 km grid and keeps nothing finer", () => {
  // A precise point in uptown Charlotte.
  const [lon, lat] = coarsen(35.227087, -80.843127)!;
  assert.deepEqual([lon, lat], [-80.84, 35.23]);
  assert.ok(decimals(lon) <= 2 && decimals(lat) <= 2);
  // Two spots a few hundred metres apart land on the same area.
  assert.deepEqual(coarsen(35.2271, -80.8431), coarsen(35.2289, -80.8399));
  // The snapped point is never more than half a grid step from the truth on each axis.
  const truth: LonLat = [-80.843127, 35.227087];
  assert.ok(Math.abs(truth[0] - lon) <= AREA_STEP / 2 && Math.abs(truth[1] - lat) <= AREA_STEP / 2);
  assert.equal(coarsen(Number.NaN, 0), null);
  assert.equal(coarsen(91, 0), null);
});

test("safeArea re-snaps whatever the server sends and rejects junk", () => {
  assert.deepEqual(safeArea([-80.843127, 35.227087]), [-80.84, 35.23]);
  assert.deepEqual(safeArea(["-80.84", "35.23"]), [-80.84, 35.23]);
  for (const bad of [null, undefined, [], [1], "x", [Number.NaN, 1], [0, 95]]) assert.equal(safeArea(bad), null);
});

test("distanceKm: Charlotte to Raleigh is about 210 km", () => {
  const d = distanceKm([-80.84, 35.23], [-78.64, 35.77]);
  assert.ok(d > 200 && d < 220, `got ${d}`);
});

test("nearby groups: live areas are their own pins, everyone else sits at their city, far cities are left out", () => {
  const live = "2099-01-01T00:00:00Z";
  const people = buildPeople(
    [member("me", "charlotte|nc"), member("a", "charlotte|nc"), member("b", "charlotte|nc"), member("c", "charlotte|nc"),
      member("d", "charlotte|nc"), member("t", "tokyo|jp"), member("h", "charlotte|nc"), member("x", "charlotte|nc")],
    [
      signal("me"), signal("a"), signal("b"),
      // c shares a live area in NoDa; d is live in Tokyo, so not in Charlotte now.
      signal("c", { live_city_key: "charlotte|nc", live_until: live, live_area: [-80.8123456, 35.2467891] }),
      signal("d", { live_city_key: "tokyo|jp", live_until: live }),
      signal("t"),
      // x shares the same area as c; h is hidden (no signal).
      signal("x", { live_city_key: "charlotte|nc", live_until: live, live_area: [-80.81, 35.25] }),
    ],
  );
  const center: LonLat = [coordinates["charlotte|nc"][0], coordinates["charlotte|nc"][1]];
  const groups = nearbyGroups(people, center, coordinates, "me");
  const byKey = Object.fromEntries(groups.map((g) => [g.key, g.people.map((p) => p.user_id)]));
  assert.deepEqual(byKey, { "city:charlotte|nc": ["a", "b"], "area:-80.81,35.25": ["c", "x"] });
  assert.equal(groups[0].kind, "city");
  // Every area pin is on the grid: no precise point can reach the map.
  for (const g of groups.filter((g) => g.kind === "area")) assert.ok(g.point.every((v) => decimals(v) <= 2));
  // Tokyo is far away; with a planet-wide radius it shows up as its own city group.
  assert.ok(nearbyGroups(people, center, coordinates, "me", 20_000).some((g) => g.key === "city:tokyo|jp"));
  assert.ok(NEARBY_KM < 100);
});

test("circleRing is closed and about the requested radius", () => {
  const center: LonLat = [-80.84, 35.23];
  const ring = circleRing(center, 600, 16);
  assert.equal(ring.length, 17);
  assert.deepEqual(ring[0].map((v) => v.toFixed(6)), ring[16].map((v) => v.toFixed(6)));
  for (const p of ring) assert.ok(Math.abs(distanceKm(center, p) - 0.6) < 0.01);
});
