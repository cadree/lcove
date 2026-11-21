// cspell:words Topo
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { geoPath } from "d3-geo";
import { globeProjection } from "./globeView.ts";
import { topologyGeometry, type Topology } from "./globeTopo.ts";
import { layersForZoom, minCityPopulation, pickCityLabels, type Place } from "./globeLod.ts";

test("the first detail tier starts at a modest zoom, with finer layers later", () => {
  assert.deepEqual(layersForZoom(1), ["countries"]);
  assert.ok(layersForZoom(1.7).includes("land50"));
  assert.ok(layersForZoom(3.2).includes("states") && layersForZoom(3.2).includes("places"));
  assert.ok(layersForZoom(6).includes("land10"));
  assert.equal(minCityPopulation(3), 800_000);
  assert.equal(minCityPopulation(6), 150_000);
  assert.equal(minCityPopulation(8), 40_000);
});

test("city labels prefer big cities, skip member faces, and stay on the disc", () => {
  const places: Place[] = [
    ["Tokyo", 139.69, 35.69, 35_000_000, 0],
    ["Yokohama", 139.65, 35.43, 3_700_000, 6],
    ["Osaka", 135.46, 34.75, 11_000_000, 1],
    ["Tiny", 139.7, 35.7, 50_000, 8],
  ];
  const rotation: [number, number] = [-139.69, -35.69];
  const projection = globeProjection(rotation, 6);
  const project = (point: [number, number]) => {
    const xy = projection(point);
    return xy ? ([xy[0], xy[1]] as [number, number]) : null;
  };
  const tokyoXy = project([139.69, 35.69])!;
  const labels = pickCityLabels(places, 6, project, rotation, 178 * 6, [{ xy: tokyoXy, point: [139.69, 35.69] }]);
  const names = labels.map((l) => l.name);
  assert.ok(names.includes("Osaka"), names.join());
  assert.ok(!names.includes("Tokyo"), "member city should not also get a typographic label");
  assert.ok(!names.includes("Yokohama"), "a label must not sit on a member face");
  assert.ok(!names.includes("Tiny"), "small cities wait for a closer zoom");
});

test("topologyGeometry turns world-atlas land into a drawable MultiPolygon", () => {
  const topology = JSON.parse(readFileSync(new URL("../../public/globe/land-50m.json", import.meta.url), "utf8")) as Topology;
  const land = topologyGeometry(topology, "land");
  assert.ok(land);
  assert.equal(land.type, "GeometryCollection");
  const path = geoPath(globeProjection([80, -25], 1));
  const d = path(land);
  assert.ok(d && d.length > 200, `path was ${d?.length}`);
});
