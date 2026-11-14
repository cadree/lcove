import { test } from "node:test";
import assert from "node:assert/strict";
import { FAN_CLEARANCE, FAN_RADIUS, MAX_ZOOM, clusterMarkers, fanOffsets, isDoubleTap, pinchZoom, stackDepth, zoomToSplit, type PlacedCity } from "./globeMarkers.ts";

const city = (key: string, x: number, count: number, avatars: string[] = []): PlacedCity => ({
  key, label: key, count, live: 0, avatars, point: [0, 0], xy: [x, 100],
});

test("nearby cities fold into one marker that keeps every city's faces", () => {
  const [m, ...rest] = clusterMarkers([city("a", 100, 2, ["a1", "a2"]), city("b", 110, 3, ["b1", "a1"]), city("c", 300, 1)], null);
  assert.equal(rest.length, 1);
  assert.equal(m.key, "b");
  assert.equal(m.cities, 2);
  assert.equal(m.total, 5);
  assert.deepEqual(m.faces, ["b1", "a1", "a2"]);
});

test("the selected city leads its cluster and faces are capped", () => {
  const [m] = clusterMarkers([city("a", 100, 1, ["1", "2", "3"]), city("b", 105, 9, ["4", "5", "6"])], "a");
  assert.equal(m.key, "a");
  assert.equal(m.faces.length, 5);
});

test("a group of one shows no stack; groups show up to two discs behind", () => {
  assert.deepEqual([1, 2, 3, 40].map(stackDepth), [0, 1, 2, 2]);
});

test("fan positions sit above the marker and spread symmetrically", () => {
  assert.deepEqual(fanOffsets(0), []);
  assert.deepEqual(fanOffsets(1), [[0, -FAN_RADIUS]]);
  const five = fanOffsets(5);
  assert.equal(five.length, 5);
  assert.ok(five.every(([, y]) => y < 0));
  assert.equal(five[0][0], -five[4][0]);
});

test("zooming a cluster goes far enough to split it, capped at the globe's limit", () => {
  const charlotte: [number, number] = [-80.84, 35.23];
  const atlanta: [number, number] = [-84.39, 33.75];
  const z = zoomToSplit([charlotte, atlanta], 1);
  assert.ok(z > 2.6 && z < MAX_ZOOM);
  assert.equal(zoomToSplit([[-78.64, 35.77], [-78.9, 35.99]], 1), MAX_ZOOM);
  assert.equal(zoomToSplit([charlotte], 2), 4);
});

test("no marker sits inside a selected city's fan: nearby cities fold into it", () => {
  // Raleigh 50px from the selected Charlotte would collide with its fanned faces (the "+2" slot).
  const near = clusterMarkers([city("charlotte", 100, 6), city("raleigh", 150, 2), city("atlanta", 100 + FAN_CLEARANCE + 4, 3)], "charlotte");
  assert.deepEqual(near.map((m) => m.key), ["charlotte", "atlanta"]);
  assert.equal(near[0].total, 8);
  // Unselected, the same two cities stay apart (50px is more than the plain gap).
  assert.equal(clusterMarkers([city("charlotte", 100, 6), city("raleigh", 150, 2)], null).length, 2);
  // Whatever is left is clear of every fan slot by at least a marker's radius.
  for (const [dx, dy] of fanOffsets(5)) {
    for (const m of near.slice(1)) assert.ok(Math.hypot(m.xy[0] - (100 + dx), m.xy[1] - (100 + dy)) >= 17);
  }
});

test("pinch zoom follows the finger spread and stays in range", () => {
  assert.equal(pinchZoom(2, 100, 150), 3);
  assert.equal(pinchZoom(2, 100, 50), 1);
  assert.equal(pinchZoom(1, 100, 20), 1);
  assert.equal(pinchZoom(8, 100, 400), MAX_ZOOM);
  assert.equal(pinchZoom(3, 0, 120), 3);
});

test("a double tap is two taps close in time and place", () => {
  const first = { t: 1000, x: 100, y: 100 };
  assert.equal(isDoubleTap(null, first), false);
  assert.equal(isDoubleTap(first, { t: 1250, x: 112, y: 95 }), true);
  assert.equal(isDoubleTap(first, { t: 1400, x: 100, y: 100 }), false);
  assert.equal(isDoubleTap(first, { t: 1100, x: 160, y: 100 }), false);
});
