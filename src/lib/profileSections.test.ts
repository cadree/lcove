import assert from "node:assert/strict";
import test from "node:test";
import { applyProfileCustomization, hexToHslChannels } from "./profileSections.ts";

const layout = [
  { id: "about", visible: true, order: 2 },
  { id: "friends", visible: true, order: 1 },
  { id: "portfolio", visible: true, order: 5 },
  { id: "posts_tabs", visible: true, order: 11 },
];

test("section toggles hide the matching profile blocks", () => {
  const next = applyProfileCustomization(layout, {
    section_order: ["about"],
    show_top_friends: false,
  });
  const byId = Object.fromEntries(next.map((section) => [section.id, section]));
  assert.equal(byId.about.visible, true);
  assert.equal(byId.portfolio.visible, false);
  assert.equal(byId.friends.visible, false);
  assert.equal(byId.posts_tabs.visible, true);
});

test("show top friends turns the friends section on", () => {
  const next = applyProfileCustomization(layout, { show_top_friends: true });
  assert.equal(next.find((section) => section.id === "friends")?.visible, true);
});

test("accent hex becomes hsl channels", () => {
  assert.equal(hexToHslChannels("#00ff9f"), "157 100% 50%");
});
