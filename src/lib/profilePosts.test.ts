import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeLinkedPost, postsForProfileGrid, postsForViewer } from "./profilePosts.ts";

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

  it("keeps a video-link post that has no uploaded file", () => {
    const posts = [
      { id: "youtube", media_url: null, content: null, embed_provider: "youtube", embed_video_id: "aqz-KE-bpKQ" },
      { id: "poison", media_url: null, content: null, embed_provider: "instagram", embed_video_id: "aqz-KE-bpKQ" },
    ];

    assert.deepEqual(
      postsForProfileGrid(posts).map((post) => post.id),
      ["youtube"],
    );
  });
});

const founder = "15a45673-0000-4000-8000-000000000001";
const postId = "ee9f2c7a-5df2-49d9-ae5d-c63e2ca03493";

describe("profile post links", () => {
  it("does not wipe the owner's posts when a block flag is set", () => {
    const posts = [{ id: postId }];
    assert.deepEqual(postsForViewer(posts, founder, founder, true), posts);
    assert.deepEqual(postsForViewer(posts, "tester", founder, true), []);
  });

  it("keeps a linked post on the profile when the list query omitted it", () => {
    const linked = { id: postId, user_id: founder };
    assert.deepEqual(mergeLinkedPost([], linked, founder), [linked]);
    assert.equal(mergeLinkedPost([linked], linked, founder).length, 1);
    assert.deepEqual(mergeLinkedPost([], linked, "someone-else"), []);
  });
});
