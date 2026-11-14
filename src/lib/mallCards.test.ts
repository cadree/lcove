import { test } from "node:test";
import assert from "node:assert/strict";
import { mallPreviews } from "./mallCards.ts";
import { features } from "../config/features.ts";

test("mall cards preview each store's newest product photos, skipping items without one", () => {
  const previews = mallPreviews([
    { store_id: "a", images: ["a1.jpg", "a1b.jpg"] },
    { store_id: "a", images: null },
    { store_id: "b", images: [] },
    { store_id: "a", images: ["a2.jpg"] },
    { store_id: "a", images: ["a1.jpg"] },
    { store_id: "a", images: ["a3.jpg"] },
    { store_id: "a", images: ["a4.jpg"] },
  ]);
  assert.deepEqual(previews.get("a"), ["a1.jpg", "a2.jpg", "a3.jpg"]);
  assert.equal(previews.has("b"), false);
});

test("hidden surfaces stay hidden unless a flag is turned back on", () => {
  assert.equal(features.exampleContent, false);
  assert.equal(features.profileBlogs, false);
  assert.equal(features.profileFilmForm, false);
  assert.equal(features.profileSavedTab, false);
});
