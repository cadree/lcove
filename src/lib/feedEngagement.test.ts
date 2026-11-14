import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { savedIdSet, tallyPostLikes } from "./feedEngagement.ts";

describe("tallyPostLikes", () => {
  it("counts likes and marks the viewer in one pass", () => {
    const tally = tallyPostLikes(
      [
        { post_id: "a", user_id: "me" },
        { post_id: "a", user_id: "other" },
        { post_id: "b", user_id: "other" },
      ],
      "me",
    );
    assert.deepEqual(tally.a, { count: 2, hasLiked: true });
    assert.deepEqual(tally.b, { count: 1, hasLiked: false });
    assert.equal(tally.c, undefined);
  });
});

describe("savedIdSet", () => {
  it("keeps the saved post ids", () => {
    assert.equal(savedIdSet([{ post_id: "a" }, { post_id: "b" }]).has("a"), true);
    assert.equal(savedIdSet([]).size, 0);
  });
});
