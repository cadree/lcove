import { test } from "node:test";
import assert from "node:assert/strict";
import { FIRST_RUN_PATH, AFTER_WELCOME_PATH, markConnectHintSeen, showConnectHint, welcomeStep } from "./firstRun.ts";

const memory = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
};

test("approved applicants first register their card, then reach Explore", () => {
  assert.equal(FIRST_RUN_PATH, "/welcome");
  assert.equal(AFTER_WELCOME_PATH.split("?")[0], "/explore");
  assert.equal(new URLSearchParams(AFTER_WELCOME_PATH.split("?")[1]).get("section"), "people");
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

test("a member whose card is registered is never redirected, only finished", () => {
  const stuck = { needs_setup: true, card_registered: true };
  for (const [path, search] of [["/feed", ""], ["/explore", "?section=people"], ["/welcome", ""], ["/id", "?setup=1"], ["/messages", ""]]) {
    assert.deepEqual(welcomeStep(stuck, path, search), { kind: "finish" });
  }
});

test("a member without a card goes to /welcome once and is left alone on the setup screens", () => {
  const fresh = { needs_setup: true, card_registered: false };
  assert.deepEqual(welcomeStep(fresh, "/feed", ""), { kind: "redirect", to: FIRST_RUN_PATH });
  assert.deepEqual(welcomeStep(fresh, "/welcome", ""), { kind: "none" });
  assert.deepEqual(welcomeStep(fresh, "/id", "?setup=1"), { kind: "none" });
  assert.deepEqual(welcomeStep(fresh, "/id", ""), { kind: "redirect", to: FIRST_RUN_PATH });
});

test("finished, legacy, or unknown welcome state never redirects", () => {
  assert.deepEqual(welcomeStep({ needs_setup: false, card_registered: true }, "/feed", ""), { kind: "none" });
  assert.deepEqual(welcomeStep({ needs_setup: false, card_registered: false }, "/feed", ""), { kind: "none" });
  assert.deepEqual(welcomeStep(null, "/feed", ""), { kind: "none" });
  assert.deepEqual(welcomeStep(undefined, "/feed", ""), { kind: "none" });
});
