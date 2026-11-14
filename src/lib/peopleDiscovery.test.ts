import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  placeOptions, inCity, buildPeople, deckFor, globeCities, homePlace, listFor, matchesQuery, nearestCity, tripBadge,
  type DiscoverySignal, type Member,
} from "./peopleDiscovery.ts";

const coordinates = JSON.parse(readFileSync("src/data/cityCoordinates.json", "utf8")) as Record<string, number[]>;
const member = (id: string, name: string, city: string | null, extra: Partial<Member> = {}): Member => ({
  user_id: id, display_name: name, avatar_url: `https://img.test/${id}.jpg`, bio: null, city, city_display: city,
  city_key: null, created_at: null, skills: [], passions: [], ...extra,
});
const signal = (id: string, extra: Partial<DiscoverySignal> = {}): DiscoverySignal => ({
  user_id: id, liked: null, live_city_key: null, live_until: null, trip: null, ...extra,
});

test("messy profile cities fold into one canonical city", () => {
  for (const typed of ["Charlotte", "charlotte, nc", "Charlotte, NC"])
    assert.equal(homePlace({ city: typed, city_display: typed, city_key: null })?.key, "charlotte|nc");
  assert.equal(homePlace({ city: null, city_display: null, city_key: "charlotte|nc" })?.label, "Charlotte, NC");
  assert.equal(homePlace({ city: "", city_display: "", city_key: "" }), null);
});

test("globe shows every discoverable member at their profile city, live city first", () => {
  const people = buildPeople(
    [member("a", "Ada", "Charlotte"), member("b", "Bo", "charlotte, nc"), member("c", "Cy", "Tokyo, Japan"), member("h", "Hidden", "Charlotte")],
    [signal("a"), signal("b", { live_city_key: "miami|fl", live_until: "2099-01-01T00:00:00Z" }), signal("c")],
  );
  const cities = globeCities(people, coordinates);
  assert.deepEqual(cities.map((c) => [c.key, c.count, c.live]), [["charlotte|nc", 1, 0], ["miami|fl", 1, 1], ["tokyo|jp", 1, 0]]);
  assert.equal(people.find((p) => p.user_id === "h")?.discoverable, false);
});

test("the list finds everyone, including hidden members; the deck does not", () => {
  const people = buildPeople(
    [member("me", "Me", "Charlotte"), member("r", "Robin", "Charlotte"), member("j", "Jo", "Charlotte", { skills: ["Photography"] })],
    [signal("me"), signal("j")],
  );
  assert.deepEqual(listFor(people, null, "robin").map((p) => p.user_id), ["r"]);
  assert.deepEqual(deckFor(people, "me", null, "").map((p) => p.user_id), ["j"]);
  assert.deepEqual(listFor(people, "charlotte|nc", "photo").map((p) => p.user_id), ["j"]);
  assert.equal(people.find((p) => p.user_id === "j")?.role, "Photography");
});

test("blocked members are dropped everywhere", () => {
  const people = buildPeople([member("x", "X", "Charlotte"), member("y", "Y", "Charlotte")], [signal("x"), signal("y")], ["x"]);
  assert.deepEqual(people.map((p) => p.user_id), ["y"]);
});

test("a city view includes people traveling there, and the deck puts undecided people first", () => {
  const trip = { city_key: "miami|fl", city_label: "Miami, FL", starts_on: "2026-11-19", ends_on: "2026-11-23" };
  const people = buildPeople(
    [member("liked", "L", "Miami"), member("new", "N", "Miami"), member("visitor", "V", "Atlanta, GA"), member("passed", "P", "Miami")],
    [signal("liked", { liked: true }), signal("new"), signal("visitor", { trip }), signal("passed", { liked: false })],
  );
  assert.deepEqual(deckFor(people, undefined, "miami|fl", "").map((p) => p.user_id), ["new", "visitor", "liked", "passed"]);
  assert.ok(matchesQuery(people[2], "miami"));
  assert.equal(tripBadge(trip), "Traveling to Miami Nov 19–23");
  assert.equal(tripBadge({ ...trip, ends_on: "2026-12-02" }), "Traveling to Miami Nov 19–Dec 2");
});

test("live location is snapped to a known city or not shared", () => {
  assert.equal(nearestCity(25.77, -80.19, coordinates), "miami|fl");
  assert.equal(nearestCity(35.68, 139.69, coordinates), "tokyo|jp");
  assert.equal(nearestCity(0, -140, coordinates), null);
});

test("the picker offers cities and their states or countries", () => {
  const people = buildPeople([member("a", "A", "Charlotte"), member("b", "B", "Raleigh, NC"), member("c", "C", "Tokyo, Japan"), member("t", "T", "Toronto, Canada"), member("l", "L", "Los Angeles, CA")], []);
  const { cities, regions } = placeOptions(people);
  assert.deepEqual(cities.map((c) => c.key).sort(), ["charlotte|nc", "los angeles|ca", "raleigh|nc", "tokyo|jp", "toronto|ca"]);
  assert.deepEqual(regions.map((r) => [r.key, r.label, r.count]), [["region:nc|NC", "NC", 2], ["region:ca|CA", "CA", 1], ["region:ca|Canada", "Canada", 1], ["region:jp|Japan", "Japan", 1]]);
  assert.deepEqual(people.filter((p) => inCity(p, "region:nc|NC")).map((p) => p.user_id), ["a", "b"]);
  assert.deepEqual(people.filter((p) => inCity(p, "region:ca|Canada")).map((p) => p.user_id), ["t"]);
});
