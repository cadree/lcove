import assert from "node:assert/strict";
import test from "node:test";
import {
  canRepostMedia,
  excludeBlocked,
  keepDeliveredMessages,
  pickDirectConversation,
  storyAdvanceHeld,
  storyAuthorButtonLabel,
  storyAuthorProfilePath,
  storyReplyInsert,
  gridViewCount,
  mergePostsAndReposts,
  messageSharePreview,
  ownerOnlyInsight,
  postPreviewPath,
  profileItemsWithReposts,
  rankSharePeople,
  repostedByLabel,
  shareMessageInsert,
  shareUrlFor,
  shouldRecordPostView,
  type SharePerson,
} from "./sharing.ts";

const maya: SharePerson = { user_id: "maya", display_name: "Maya", avatar_url: null };
const jon: SharePerson = { user_id: "jon", display_name: "Jon", avatar_url: null };
const ada: SharePerson = { user_id: "ada", display_name: "Ada", avatar_url: null };

test("share people drop blocked users, yourself, and duplicates", () => {
  const ranked = rankSharePeople([maya, jon], [jon, ada, maya], ["jon"], "ada");
  assert.deepEqual(ranked.map((person) => person.user_id), ["maya"]);
  assert.deepEqual(excludeBlocked([maya, maya], [], "maya"), []);
});

test("owner views are not recorded and are the only ones shown", () => {
  assert.equal(shouldRecordPostView("owner", "owner"), false);
  assert.equal(shouldRecordPostView(null, "owner"), false);
  assert.equal(shouldRecordPostView("viewer", "owner"), true);
  assert.equal(ownerOnlyInsight(false, 40, 3), null);
  assert.equal(gridViewCount(false, { post: 40 }, "post"), null);
  assert.equal(ownerOnlyInsight(true, 1, 2), "Only you can see this: 2 likes · 1 view");
  assert.equal(ownerOnlyInsight(true, 0, 0), "Only you can see this: 0 views");
  assert.equal(gridViewCount(true, { post: 4 }, "post"), 4);
});

test("reposts keep the original post and sort by the repost time", () => {
  const posts = [
    { id: "p1", user_id: "maya", created_at: "2026-10-01T00:00:00.000Z", media_type: "photo" },
    { id: "p2", user_id: "jon", created_at: "2026-10-02T00:00:00.000Z", media_type: "video" },
  ];
  const merged = mergePostsAndReposts(posts, [
    {
      id: "r1",
      user_id: "ada",
      post_id: "p1",
      created_at: "2026-10-03T00:00:00.000Z",
      profile: { display_name: "Ada", avatar_url: null },
    },
  ]);
  assert.equal(merged[0].feed_key, "repost:r1");
  assert.equal(merged[0].user_id, "maya");
  assert.equal(repostedByLabel(merged[0].repost?.profile?.display_name), "Reposted by Ada");
  assert.equal(merged.filter((item) => item.id === "p1").length, 2);
  assert.equal(canRepostMedia("photo", "maya", "ada"), true);
  assert.equal(canRepostMedia("photo", "maya", "maya"), false);
  assert.equal(canRepostMedia("text", "maya", "ada"), false);
  assert.equal(canRepostMedia("video", "maya", null), false);
});

test("story playback waits while a reply or the share sheet is open", () => {
  assert.equal(storyAdvanceHeld({ replyFocused: false, shareOpen: false }), false);
  assert.equal(storyAdvanceHeld({ replyFocused: true, shareOpen: false }), true);
  assert.equal(storyAdvanceHeld({ replyFocused: false, shareOpen: true }), true);
  assert.equal(storyAdvanceHeld({ replyFocused: false, shareOpen: false, sending: true }), true);
  assert.equal(storyAdvanceHeld({ replyFocused: false, shareOpen: false, hasDraft: true }), true);
});

test("story header opens the poster's profile and does not advance", () => {
  const founder = "15a45673-0000-4000-8000-000000000001";
  assert.equal(storyAuthorProfilePath(founder), `/profile/${founder}`);
  assert.equal(storyAuthorProfilePath("  maya  "), "/profile/maya");
  assert.equal(storyAuthorProfilePath("  "), null);
  assert.equal(storyAuthorProfilePath(null), null);
  assert.equal(storyAuthorButtonLabel("Maya", false), "View Maya's profile");
  assert.equal(storyAuthorButtonLabel("Maya", true), "Your profile");
  assert.equal(storyAuthorButtonLabel("  ", false), "View profile");
});

test("two story replies stay two messages in one chat", () => {
  const first = storyReplyInsert("ada", "conv-1", "story-1", " first ");
  const second = storyReplyInsert("ada", "conv-1", "story-1", "second");
  assert.equal(first.conversation_id, second.conversation_id);
  assert.equal(first.shared_story_id, second.shared_story_id);
  assert.notEqual(first.content, second.content);
  const delivered = keepDeliveredMessages([
    { id: "m1", content: first.content, shared_story_id: first.shared_story_id },
    { id: "m2", content: second.content, shared_story_id: second.shared_story_id },
    { id: "m2", content: second.content, shared_story_id: second.shared_story_id },
  ]);
  assert.deepEqual(delivered.map((message) => message.content), ["first", "second"]);
  assert.equal(
    pickDirectConversation([
      { id: "project", type: "direct", project_id: "p", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "newer", type: "direct", project_id: null, created_at: "2026-02-01T00:00:00.000Z" },
      { id: "older", type: "direct", project_id: null, created_at: "2026-01-02T00:00:00.000Z" },
      { id: "group", type: "group", project_id: null, created_at: "2020-01-01T00:00:00.000Z" },
    ]),
    "older",
  );
});

test("blocked authors and reposters stay out of the profile grid", () => {
  const items = profileItemsWithReposts(
    [{ id: "mine", user_id: "ada", created_at: "2026-10-01T00:00:00.000Z" }],
    [
      { id: "r-ok", user_id: "ada", post_id: "theirs", created_at: "2026-10-04T00:00:00.000Z", profile: null },
      { id: "r-no", user_id: "ada", post_id: "blocked", created_at: "2026-10-05T00:00:00.000Z", profile: null },
    ],
    [
      { id: "theirs", user_id: "maya", created_at: "2026-09-01T00:00:00.000Z" },
      { id: "blocked", user_id: "jon", created_at: "2026-09-01T00:00:00.000Z" },
    ],
    ["jon"],
  );
  assert.deepEqual(items.map((item) => item.grid_key), ["r-ok", "mine"]);
  assert.equal(items[0].user_id, "maya");
});

test("a sent post becomes a message that opens the original", () => {
  const row = shareMessageInsert("ada", "conv", {
    kind: "post",
    post: { id: "p1", user_id: "maya", content: "hello", media_url: null, media_type: "photo" },
  }, "  look  ");
  assert.equal(row.shared_post_id, "p1");
  assert.equal(row.content, "look");
  assert.equal(row.shared_story_id, null);
  const preview = messageSharePreview(row, {
    posts: new Map([["p1", { id: "p1", user_id: "maya", content: "hello", media_url: "m.jpg", media_type: "photo", author: "Maya" }]]),
    stories: new Map(),
    profiles: new Map(),
  });
  assert.equal(preview?.href, postPreviewPath("maya", "p1"));
  assert.equal(preview?.title, "Maya");
  assert.equal(shareUrlFor({
    kind: "profile",
    profile: { user_id: "maya", display_name: "Maya", avatar_url: null },
  }), "https://etherbylcove.com/profile/maya");
});
