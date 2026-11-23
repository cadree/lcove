import assert from "node:assert/strict";
import test from "node:test";
import {
  inFeedLocation,
  locationChoices,
  locationOf,
  memberLocations,
  readFeedLocation,
  writeFeedLocation,
} from "./feedLocation.ts";

function memoryStore() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    map,
  };
}

test("a typed place resolves to the city key profiles are matched on", () => {
  assert.deepEqual(locationOf("Manhattan, New York"), { key: "manhattan|ny", label: "Manhattan, NY" });
  assert.equal(locationOf("charlotte")?.key, "charlotte|nc");
  assert.equal(locationOf("  "), null);
});

test("only profiles in the chosen place pass; no place means everywhere", () => {
  const manhattan = { key: "manhattan|ny", label: "Manhattan, NY" };
  assert.equal(inFeedLocation({ city: "Manhattan, NY" }, manhattan), true);
  assert.equal(inFeedLocation({ city: null, city_display: "Manhattan" }, manhattan), true);
  assert.equal(inFeedLocation({ city: "Brooklyn, NY" }, manhattan), false);
  assert.equal(inFeedLocation({ city: "Charlotte, NC" }, manhattan), false);
  assert.equal(inFeedLocation(null, manhattan), false);
  assert.equal(inFeedLocation({ city: "Charlotte, NC" }, null), true);
});

test("the choice is kept per member and can be cleared", () => {
  const store = memoryStore();
  writeFeedLocation(store, "u1", { key: "manhattan|ny", label: "Manhattan, NY" });
  assert.deepEqual(readFeedLocation(store, "u1"), { key: "manhattan|ny", label: "Manhattan, NY" });
  assert.equal(readFeedLocation(store, "u2"), null);
  writeFeedLocation(store, "u1", null);
  assert.equal(readFeedLocation(store, "u1"), null);
  store.setItem("ether.feed-location.u3", "{not json");
  assert.equal(readFeedLocation(store, "u3"), null);
});

test("the picker lists places members are in first, then any known place", () => {
  const members = memberLocations([
    { city: "Charlotte, NC" }, { city: "charlotte" }, { city: "Manhattan, NY" }, { city: null },
  ]);
  assert.deepEqual(members.map((m) => [m.label, m.members]), [["Charlotte, NC", 2], ["Manhattan, NY", 1]]);
  assert.deepEqual(locationChoices(members, ""), members);
  const manhattan = locationChoices(members, "manhattan");
  assert.equal(manhattan[0].key, "manhattan|ny");
  assert.equal(manhattan[0].members, 1);
  assert.ok(manhattan.some((row) => row.key === "manhattan|ks" && row.members === 0));
});
