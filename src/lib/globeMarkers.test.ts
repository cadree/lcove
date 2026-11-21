import { test } from "node:test";
import assert from "node:assert/strict";
import { CARD, CARD_GAP, MAX_ZOOM, clusterMarkers, isDoubleTap, pinchZoom, zoomToSplit, type PlacedCity } from "./globeMarkers.ts";

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

test("zooming a cluster goes far enough to split it, capped at the globe's limit", () => {
  const charlotte: [number, number] = [-80.84, 35.23];
  const atlanta: [number, number] = [-84.39, 33.75];
  const z = zoomToSplit([charlotte, atlanta], 1);
  assert.ok(z > 2.6 && z < MAX_ZOOM);
  assert.equal(zoomToSplit([[-78.64, 35.77], [-78.9, 35.99]], 1), MAX_ZOOM);
  assert.equal(zoomToSplit([charlotte], 2), 4);
});

test("city cards never overlap: anchors closer than a card fold into one, farther ones stay apart", () => {
  assert.ok(CARD_GAP >= CARD.w, "the fold distance covers a whole card width");
  const near = clusterMarkers([city("charlotte", 100, 6), city("concord", 100 + CARD_GAP - 1, 2), city("atlanta", 100 + CARD_GAP + 1, 3)], null);
  assert.deepEqual(near.map((m) => m.key), ["charlotte", "atlanta"]);
  assert.equal(near[0].total, 8);
  assert.equal(near[0].cities, 2);
  // Selecting a city no longer widens its footprint: there is no fan of faces to make room for.
  assert.deepEqual(clusterMarkers([city("charlotte", 100, 6), city("atlanta", 100 + CARD_GAP + 1, 3)], "atlanta").map((m) => m.key), ["atlanta", "charlotte"]);
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
