import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DIRECTORY_RENDER_PAGE,
  FEED_POST_LIMIT,
  FEED_RENDER_PAGE,
  listEnterDelay,
  nextRenderedCount,
  storyViewShouldRefresh,
} from "./feedWindow.ts";

describe("feed window", () => {
  it("caps the first paint and grows by a page", () => {
    assert.equal(FEED_POST_LIMIT > FEED_RENDER_PAGE, true);
    assert.equal(nextRenderedCount(0, 40), FEED_RENDER_PAGE);
    assert.equal(nextRenderedCount(12, 40), 24);
    assert.equal(nextRenderedCount(36, 40), 40);
    assert.equal(nextRenderedCount(0, 10, DIRECTORY_RENDER_PAGE), 10);
  });

  it("does not schedule a delay for every row", () => {
    assert.equal(listEnterDelay(0), 0);
    assert.equal(listEnterDelay(2, 0.05), 0.1);
    assert.equal(listEnterDelay(80, 0.05), 6 * 0.05);
  });

  it("refreshes story views only for a story this phone owns", () => {
    const owned = new Set(["mine"]);
    assert.equal(storyViewShouldRefresh("mine", owned), true);
    assert.equal(storyViewShouldRefresh("theirs", owned), false);
    assert.equal(storyViewShouldRefresh(undefined, owned), false);
  });
});
