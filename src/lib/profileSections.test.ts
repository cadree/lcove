import assert from "node:assert/strict";
import test from "node:test";
import {
  applyProfileCustomization,
  hexToHslChannels,
  sectionFieldsForSave,
  sectionStateFromLayout,
} from "./profileSections.ts";

const layout = [
  { id: "stats", visible: true, order: 0 },
  { id: "friends", visible: true, order: 1 },
  { id: "about", visible: true, order: 2 },
  { id: "portfolio", visible: true, order: 5 },
  { id: "music", visible: false, order: 10 },
  { id: "posts_tabs", visible: true, order: 11 },
];

test("section toggles hide the matching profile blocks without moving them", () => {
  const next = applyProfileCustomization(layout, {
    section_order: ["about"],
    show_top_friends: false,
  });
  const byId = Object.fromEntries(next.map((section) => [section.id, section]));
  assert.equal(byId.about.visible, true);
  assert.equal(byId.about.order, 2);
  assert.equal(byId.portfolio.visible, false);
  assert.equal(byId.portfolio.order, 5);
  assert.equal(byId.friends.visible, false);
  assert.equal(byId.friends.order, 1);
  assert.equal(byId.posts_tabs.visible, true);
  assert.equal(byId.stats.order, 0);
});

test("show top friends turns the friends section on", () => {
  const hidden = layout.map((section) =>
    section.id === "friends" ? { ...section, visible: false } : section,
  );
  const next = applyProfileCustomization(hidden, { show_top_friends: true });
  assert.equal(next.find((section) => section.id === "friends")?.visible, true);
});

test("the old font-save defaults leave the profile untouched", () => {
  const next = applyProfileCustomization(layout, {
    section_order: ["about", "music", "stats", "links"],
    show_top_friends: false,
  });
  assert.deepEqual(next, layout);
});

test("saving the current sections persists no section override", () => {
  const derived = sectionStateFromLayout(layout);
  assert.equal(derived.showTopFriends, true);
  assert.equal(derived.sectionOrder.includes("music"), false);
  assert.deepEqual(sectionFieldsForSave(derived, layout), {
    section_order: null,
    show_top_friends: null,
  });
});

test("hiding top friends does not rewrite the other sections", () => {
  const derived = sectionStateFromLayout(layout);
  const fields = sectionFieldsForSave({ ...derived, showTopFriends: false }, layout);
  assert.equal(fields.section_order, null);
  assert.equal(fields.show_top_friends, false);
  const next = applyProfileCustomization(layout, fields);
  const byId = Object.fromEntries(next.map((section) => [section.id, section]));
  assert.equal(byId.friends.visible, false);
  assert.equal(byId.stats.order, 0);
  assert.equal(byId.about.order, 2);
  assert.equal(byId.music.visible, false);
});

test("accent hex becomes hsl channels", () => {
  assert.equal(hexToHslChannels("#00ff9f"), "157 100% 50%");
});
