import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { postsForProfileGrid } from "./profilePosts.ts";

describe("postsForProfileGrid", () => {
  it("keeps a caption-only post that the photo grid used to drop", () => {
    const posts = [
      { id: "text", media_url: null, content: "First day on Ether" },
      { id: "empty", media_url: null, content: "   " },
      { id: "photo", media_url: "https://cdn.example/photo.jpg", content: null },
    ];

    assert.deepEqual(
      postsForProfileGrid(posts).map((post) => post.id),
      ["text", "photo"],
    );
  });
});
