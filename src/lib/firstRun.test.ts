import { test } from "node:test";
import assert from "node:assert/strict";
import { FIRST_RUN_PATH, markConnectHintSeen, showConnectHint } from "./firstRun.ts";

const memory = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
};

test("onboarding lands on the people deck", () => {
  assert.equal(FIRST_RUN_PATH.split("?")[0], "/explore");
  assert.equal(new URLSearchParams(FIRST_RUN_PATH.split("?")[1]).get("section"), "people");
});

test("the Connect hint shows once, only after onboarding, per member", () => {
  const store = memory();
  assert.equal(showConnectHint(store, "u1", "?section=people"), false);
  assert.equal(showConnectHint(store, undefined, "?welcome=1"), false);
  assert.equal(showConnectHint(store, "u1", "?section=people&welcome=1"), true);
  markConnectHintSeen(store, "u1");
  assert.equal(showConnectHint(store, "u1", "?welcome=1"), false);
  assert.equal(showConnectHint(store, "u2", "?welcome=1"), true);
});

test("a storage that throws never blocks the page", () => {
  const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
  assert.equal(showConnectHint(broken, "u1", "?welcome=1"), false);
  assert.doesNotThrow(() => markConnectHintSeen(broken, "u1"));
});
