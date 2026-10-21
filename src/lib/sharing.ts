import { buildShareUrl } from "./shareLink.ts";

export interface SharePerson {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface RepostRow {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export type ShareTarget =
  | {
      kind: "post";
      post: {
        id: string;
        user_id: string;
        content: string | null;
        media_url: string | null;
        media_type: string | null;
        profile?: { display_name: string | null; avatar_url?: string | null } | null;
      };
    }
  | {
      kind: "profile";
      profile: {
        user_id: string;
        display_name: string | null;
        avatar_url: string | null;
      };
    }
  | {
      kind: "story";
      story: {
        id: string;
        user_id: string;
        media_url: string;
        media_type: string;
        profile?: { display_name: string | null } | null;
      };
    };

export function excludeBlocked<T extends { user_id: string }>(
  people: T[],
  blockedIds: string[],
  selfId?: string | null,
): T[] {
  const blocked = new Set(blockedIds);
  const seen = new Set<string>();
  const out: T[] = [];
  for (const person of people) {
    if (!person.user_id || person.user_id === selfId) continue;
    if (blocked.has(person.user_id)) continue;
    if (seen.has(person.user_id)) continue;
    seen.add(person.user_id);
    out.push(person);
  }
  return out;
}

export function rankSharePeople(
  recent: SharePerson[],
  suggested: SharePerson[],
  blockedIds: string[],
  selfId?: string | null,
): SharePerson[] {
  const recentIds = new Set(recent.map((person) => person.user_id));
  return excludeBlocked(
    [...recent, ...suggested.filter((person) => !recentIds.has(person.user_id))],
    blockedIds,
    selfId,
  );
}

export function shouldRecordPostView(viewerId: string | null | undefined, ownerId: string | null | undefined): boolean {
  return Boolean(viewerId && ownerId && viewerId !== ownerId);
}

export function storyAdvanceHeld(input: {
  replyFocused: boolean;
  shareOpen: boolean;
  sending?: boolean;
  hasDraft?: boolean;
}): boolean {
  return input.replyFocused || input.shareOpen || Boolean(input.sending) || Boolean(input.hasDraft);
}

/** Profile opened from the story header. The poster's own story uses the same path. */
export function storyAuthorProfilePath(userId: string | null | undefined): string | null {
  const id = userId?.trim();
  if (!id) return null;
  return `/profile/${id}`;
}

/** Accessible name for the header control. It does not advance the story. */
export function storyAuthorButtonLabel(displayName: string | null | undefined, isOwner: boolean): string {
  if (isOwner) return "Your profile";
  const name = displayName?.trim();
  return name ? `View ${name}'s profile` : "View profile";
}

export interface DirectConversationPick {
  id: string;
  type: string;
  project_id?: string | null;
  created_at: string;
}

/** Personal direct chats only, oldest first, so two replies cannot split across chats. */
export function pickDirectConversation(conversations: DirectConversationPick[]): string | null {
  const personal = conversations
    .filter((conversation) => conversation.type === "direct" && !conversation.project_id)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  return personal[0]?.id ?? null;
}

export function storyReplyInsert(senderId: string, conversationId: string, storyId: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Write a message");
  return {
    conversation_id: conversationId,
    sender_id: senderId,
    content: trimmed,
    shared_story_id: storyId,
  };
}

/** Keep every delivered row. Same story id is not a duplicate. Same message id is. */
export function keepDeliveredMessages<T extends { id: string }>(messages: T[]): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const message of messages) {
    if (!message.id || seen.has(message.id)) continue;
    seen.add(message.id);
    kept.push(message);
  }
  return kept;
}

export function canRepostMedia(
  mediaType: string | null | undefined,
  ownerId: string,
  viewerId: string | null | undefined,
): boolean {
  if (!viewerId || viewerId === ownerId) return false;
  return mediaType === "photo" || mediaType === "video";
}

export function repostedByLabel(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? `Reposted by ${trimmed}` : "Reposted by someone";
}

export function ownerOnlyInsight(isOwner: boolean, views: number | undefined, likes: number): string | null {
  if (!isOwner) return null;
  const parts: string[] = [];
  if (likes > 0) parts.push(likes === 1 ? "1 like" : `${likes} likes`);
  if (views != null) parts.push(views === 1 ? "1 view" : `${views} views`);
  if (parts.length === 0) return null;
  return `Only you can see this: ${parts.join(" · ")}`;
}

export function gridViewCount(
  isOwner: boolean,
  counts: Record<string, number> | undefined,
  postId: string,
): number | null {
  if (!isOwner || !counts || counts[postId] == null) return null;
  return counts[postId];
}

export function shareUrlFor(target: ShareTarget): string {
  if (target.kind === "post") return buildShareUrl.post(target.post.user_id, target.post.id);
  if (target.kind === "profile") return buildShareUrl.profile(target.profile.user_id);
  return buildShareUrl.profile(target.story.user_id);
}

export function shareMessageInsert(
  senderId: string,
  conversationId: string,
  target: ShareTarget,
  note: string,
) {
  return {
    conversation_id: conversationId,
    sender_id: senderId,
    content: note.trim() ? note.trim() : null,
    shared_post_id: target.kind === "post" ? target.post.id : null,
    shared_story_id: target.kind === "story" ? target.story.id : null,
    shared_profile_id: target.kind === "profile" ? target.profile.user_id : null,
  };
}

export function mergePostsAndReposts<T extends { id: string; created_at: string; user_id: string }>(
  posts: T[],
  reposts: RepostRow[],
  blockedIds: string[] = [],
): Array<T & { feed_key: string; repost: RepostRow | null }> {
  const blocked = new Set(blockedIds);
  const visible = posts.filter((post) => !blocked.has(post.user_id));
  const byId = new Map(visible.map((post) => [post.id, post]));
  const originals = visible.map((post) => ({
    ...post,
    feed_key: post.id,
    repost: null as RepostRow | null,
  }));
  const reposted = reposts.flatMap((repost) => {
    if (blocked.has(repost.user_id)) return [];
    const post = byId.get(repost.post_id);
    if (!post) return [];
    return [{
      ...post,
      feed_key: `repost:${repost.id}`,
      repost,
    }];
  });
  return [...originals, ...reposted].sort((a, b) => {
    const aAt = a.repost?.created_at ?? a.created_at;
    const bAt = b.repost?.created_at ?? b.created_at;
    return bAt.localeCompare(aAt);
  });
}

export function profileItemsWithReposts<T extends { id: string; created_at: string; user_id: string }>(
  ownPosts: T[],
  reposts: RepostRow[],
  originals: T[],
  blockedIds: string[] = [],
): Array<T & { grid_key: string; repost: RepostRow | null }> {
  const blocked = new Set(blockedIds);
  const byId = new Map(originals.filter((post) => !blocked.has(post.user_id)).map((post) => [post.id, post]));
  const own = ownPosts
    .filter((post) => !blocked.has(post.user_id))
    .map((post) => ({ ...post, grid_key: post.id, repost: null as RepostRow | null }));
  const extra = reposts.flatMap((repost) => {
    if (blocked.has(repost.user_id)) return [];
    const post = byId.get(repost.post_id);
    if (!post || blocked.has(post.user_id)) return [];
    return [{ ...post, grid_key: repost.id, repost }];
  });
  return [...own, ...extra].sort((a, b) => {
    const aAt = a.repost?.created_at ?? a.created_at;
    const bAt = b.repost?.created_at ?? b.created_at;
    return bAt.localeCompare(aAt);
  });
}

export interface MessageShareSource {
  shared_post_id?: string | null;
  shared_story_id?: string | null;
  shared_profile_id?: string | null;
}

export interface MessageSharePreview {
  kind: "post" | "story" | "profile";
  href: string;
  title: string;
  subtitle: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
}

export function messageSharePreview(
  message: MessageShareSource,
  lookups: {
    posts: Map<string, { id: string; user_id: string; content: string | null; media_url: string | null; media_type: string | null; author: string | null }>;
    stories: Map<string, { id: string; user_id: string; media_url: string; media_type: string; author: string | null }>;
    profiles: Map<string, { user_id: string; display_name: string | null; avatar_url: string | null }>;
  },
): MessageSharePreview | null {
  if (message.shared_post_id) {
    const post = lookups.posts.get(message.shared_post_id);
    if (!post) {
      return {
        kind: "post",
        href: "",
        title: "Post unavailable",
        subtitle: null,
        mediaUrl: null,
        mediaType: null,
      };
    }
    return {
      kind: "post",
      href: postPreviewPath(post.user_id, post.id),
      title: post.author || "Post",
      subtitle: post.content,
      mediaUrl: post.media_url,
      mediaType: post.media_type,
    };
  }
  if (message.shared_story_id) {
    const story = lookups.stories.get(message.shared_story_id);
    if (!story) {
      return {
        kind: "story",
        href: "",
        title: "Story unavailable",
        subtitle: null,
        mediaUrl: null,
        mediaType: null,
      };
    }
    return {
      kind: "story",
      href: `/profile/${story.user_id}`,
      title: story.author || "Story",
      subtitle: "Story",
      mediaUrl: story.media_url,
      mediaType: story.media_type,
    };
  }
  if (message.shared_profile_id) {
    const profile = lookups.profiles.get(message.shared_profile_id);
    return {
      kind: "profile",
      href: `/profile/${message.shared_profile_id}`,
      title: profile?.display_name || "Profile",
      subtitle: "Profile",
      mediaUrl: profile?.avatar_url ?? null,
      mediaType: "photo",
    };
  }
  return null;
}

/** In-app path for a post preview. The public URL is only for copy link. */
export function postPreviewPath(userId: string, postId: string): string {
  return `/profile/${userId}?post=${postId}`;
}
