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

describe("post card extras", async () => {
  const { compactCount, recentLikers, tallyComments } = await import("./feedEngagement.ts");
  it("keeps the three newest other likers per post", () => {
    const rows = [
      { post_id: "a", user_id: "me" },
      { post_id: "a", user_id: "u1" },
      { post_id: "a", user_id: "u2" },
      { post_id: "a", user_id: "u3" },
      { post_id: "a", user_id: "u4" },
      { post_id: "b", user_id: "u1" },
    ];
    assert.deepEqual(recentLikers(rows, "me"), { a: ["u1", "u2", "u3"], b: ["u1"] });
  });
  it("counts comments and shortens big numbers", () => {
    assert.deepEqual(tallyComments([{ post_id: "a" }, { post_id: "a" }, { post_id: "b" }]), { a: 2, b: 1 });
    assert.equal(compactCount(24), "24");
    assert.equal(compactCount(1200), "1.2k");
    assert.equal(compactCount(12100), "12k");
    assert.equal(compactCount(3000), "3k");
  });
});
