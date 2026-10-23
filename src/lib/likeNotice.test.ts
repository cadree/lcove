import assert from "node:assert/strict";
import test from "node:test";
import {
  captionSnippet,
  likeTarget,
  notificationDisplay,
  notificationsForTab,
  postIdsForLikes,
  postLikeFields,
  storyOpenPlan,
  storyStartIndex,
  type LikeNotice,
} from "./likeNotice.ts";

const storyId = "7981ffd9-e984-4a49-85ce-285b03d1324b";
const postId = "11111111-1111-4111-8111-111111111111";
const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const storyLike: LikeNotice & { id: string } = {
  id: "story-like",
  type: "like",
  title: "Story like",
  body: "Maya liked your story",
  user_id: ownerId,
  data: { story_id: storyId },
};

const postLike: LikeNotice & { id: string } = {
  id: "post-like",
  type: "like",
  title: "Someone liked your post",
  body: "Jon liked your post",
  user_id: ownerId,
  data: { post_id: postId },
};

const message: LikeNotice & { id: string } = {
  id: "msg",
  type: "message",
  title: "New Message",
  body: "Ada sent you a message",
  user_id: ownerId,
  data: { action: "open_messages" },
};

test("a story like without a post id stays in All and Likes", () => {
  const items = [storyLike, postLike, message];
  assert.deepEqual(
    notificationsForTab(items, "all").map((item) => item.id),
    ["story-like", "post-like", "msg"],
  );
  assert.deepEqual(
    notificationsForTab(items, "like").map((item) => item.id),
    ["story-like", "post-like"],
  );
  assert.deepEqual(likeTarget(storyLike), { kind: "story", storyId, ownerId });
  assert.equal(notificationDisplay(storyLike).title, "Maya liked your story");
  assert.equal(notificationDisplay(storyLike).detail, null);
});

test("a story like title can already be the sentence", () => {
  const shown = notificationDisplay({
    ...storyLike,
    title: "Maya liked your story",
    body: null,
  });
  assert.equal(shown.title, "Maya liked your story");
});

test("a post like names the post with a caption or a thumbnail", () => {
  const fromFetch = notificationDisplay(postLike, {
    content: "Night shoot on the roof",
    media_url: "https://cdn.example/roof.jpg",
    media_type: "photo",
  });
  assert.equal(fromFetch.title, "Jon liked your post");
  assert.equal(fromFetch.detail, "Night shoot on the roof");
  assert.equal(fromFetch.thumbUrl, "https://cdn.example/roof.jpg");
  assert.equal(fromFetch.thumbIsVideo, false);

  const stored = notificationDisplay({
    ...postLike,
    title: "Jon liked your post",
    body: "Night shoot on the roof",
    data: {
      post_id: postId,
      caption: "Night shoot on the roof",
      media_url: "https://cdn.example/roof.mp4",
      media_type: "video",
    },
  });
  assert.equal(stored.title, "Jon liked your post");
  assert.equal(stored.detail, "Night shoot on the roof");
  assert.equal(stored.thumbIsVideo, true);
  assert.deepEqual(postIdsForLikes([storyLike, postLike, message]), [postId]);
});

test("caption snippets stay on one line", () => {
  assert.equal(captionSnippet("  line one\nline two  "), "line one line two");
  assert.equal(captionSnippet("   "), null);
  const long = "word ".repeat(30).trim();
  const snippet = captionSnippet(long);
  assert.ok(snippet);
  assert.equal(snippet.length <= 80, true);
  assert.equal(snippet.endsWith("…"), true);
  assert.deepEqual(postLikeFields({ caption: long, mediaUrl: "javascript:alert(1)", mediaType: "photo" }), {
    body: snippet,
    data: { caption: snippet, media_type: "photo" },
  });
});

test("an expired story opens the profile, a live story opens on that story", () => {
  assert.deepEqual(storyOpenPlan([], storyId, ownerId), {
    kind: "profile",
    path: `/profile/${ownerId}`,
  });
  assert.deepEqual(storyOpenPlan(["older", storyId, "newer"], storyId, ownerId), {
    kind: "story",
    initialStoryId: storyId,
  });
  assert.equal(storyStartIndex([{ id: "older" }, { id: storyId }, { id: "newer" }], storyId), 1);
  assert.equal(storyStartIndex([{ id: "older" }], "missing"), 0);
});
