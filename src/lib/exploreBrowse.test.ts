import assert from "node:assert/strict";
import test from "node:test";
import { browsePosts, collectReels, growVisibleCount, matchesBrowseQuery } from "./exploreBrowse.ts";

test("reels are video stories and video posts", () => {
  const reels = collectReels(
    [
      { id: "s1", user_id: "u1", media_url: "s.mp4", media_type: "video", profile: { display_name: "Ada" } },
      { id: "s2", user_id: "u2", media_url: "s.jpg", media_type: "photo", profile: { display_name: "Bea" } },
    ],
    [
      { id: "p1", user_id: "u3", media_url: "p.mp4", media_type: "video", profile: { display_name: "Cy" } },
      { id: "p2", user_id: "u4", media_url: "p.jpg", media_type: "photo", profile: { display_name: "Dee" } },
    ],
  );
  assert.deepEqual(reels.map((reel) => reel.id), ["story-s1", "post-p1"]);
  assert.equal(reels[0].userId, "u1");
});

test("posts and portfolios stay on their own lanes", () => {
  const posts = [
    { id: "a", user_id: "u", media_url: null, media_type: "text", post_type: "regular" },
    { id: "b", user_id: "u", media_url: null, media_type: "photo", post_type: "portfolio" },
  ];
  assert.deepEqual(browsePosts(posts, "posts").map((post) => post.id), ["a"]);
  assert.deepEqual(browsePosts(posts, "portfolios").map((post) => post.id), ["b"]);
});

test("search matches a name or caption", () => {
  assert.equal(matchesBrowseQuery("Ada", "hello", ""), true);
  assert.equal(matchesBrowseQuery("Ada", "hello", "ada"), true);
  assert.equal(matchesBrowseQuery("Ada", "golden hour", "gold"), true);
  assert.equal(matchesBrowseQuery("Ada", "hello", "zoe"), false);
});

test("the visible window grows and then cycles", () => {
  assert.equal(growVisibleCount(2, 5, 3), 5);
  assert.equal(growVisibleCount(5, 5, 3), 8);
  assert.equal(growVisibleCount(0, 0, 3), 0);
});
