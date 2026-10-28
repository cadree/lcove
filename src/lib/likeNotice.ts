/**
 * How a like appears in Notifications.
 * A story like has data.story_id and no post_id. A post like has data.post_id.
 * Both use type "like", so All and Likes keep them.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORY_LIKE = /liked your story/i;
const POST_LIKE = /liked your post/i;

export interface LikeNotice {
  type: string;
  title: string;
  body: string | null;
  user_id: string;
  data: unknown;
}

export interface PostLikePreview {
  content?: string | null;
  media_url?: string | null;
  media_type?: string | null;
}

export type LikeTarget =
  | { kind: "story"; storyId: string; ownerId: string }
  | { kind: "post"; postId: string; ownerId: string };

export interface LikeNoticeDisplay {
  title: string;
  detail: string | null;
  thumbUrl: string | null;
  thumbIsVideo: boolean;
}

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

function asRecord(data: unknown): Record<string, unknown> {
  if (!data) return {};
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  return {};
}

function stringField(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function uuidField(value: unknown): string | null {
  if (typeof value !== "string" || !UUID.test(value)) return null;
  return value;
}

export function safeMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return null;
}

export function captionSnippet(content: string | null | undefined, max = 80): string | null {
  if (!content) return null;
  const flat = content.replace(/\s+/g, " ").trim();
  if (!flat) return null;
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

export function likeTarget(notification: Pick<LikeNotice, "type" | "user_id" | "data">): LikeTarget | null {
  if (notification.type !== "like") return null;
  const data = asRecord(notification.data);
  const storyId = uuidField(data.story_id);
  if (storyId) return { kind: "story", storyId, ownerId: notification.user_id };
  const postId = uuidField(data.post_id);
  if (postId) return { kind: "post", postId, ownerId: notification.user_id };
  return null;
}

export function notificationsForTab<T extends { type: string }>(items: T[], tab: string): T[] {
  if (tab === "all") return items;
  return items.filter((item) => item.type === tab);
}

export function postIdsForLikes(items: Pick<LikeNotice, "type" | "user_id" | "data">[]): string[] {
  const ids = new Set<string>();
  for (const item of items) {
    const target = likeTarget(item);
    if (target?.kind === "post") ids.add(target.postId);
  }
  return [...ids].sort();
}

function likeSentence(value: string | null | undefined, pattern: RegExp): string | null {
  const text = value?.trim();
  if (!text || !pattern.test(text)) return null;
  return text;
}

function storyLikeLine(notification: Pick<LikeNotice, "title" | "body">): string {
  return (
    likeSentence(notification.body, STORY_LIKE) ??
    likeSentence(notification.title, STORY_LIKE) ??
    "Someone liked your story"
  );
}

function postLikeLine(notification: Pick<LikeNotice, "title" | "body">): string {
  const body = likeSentence(notification.body, POST_LIKE);
  const title = likeSentence(notification.title, POST_LIKE);
  const named = [body, title].find((line) => line && !/^someone liked your post$/i.test(line));
  return named ?? body ?? title ?? "Someone liked your post";
}

function isVideo(mediaType: string | null, url: string): boolean {
  if (mediaType === "video") return true;
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

export function notificationDisplay(
  notification: LikeNotice,
  preview?: PostLikePreview | null,
): LikeNoticeDisplay {
  const target = likeTarget(notification);
  if (target?.kind === "story") {
    return { title: storyLikeLine(notification), detail: null, thumbUrl: null, thumbIsVideo: false };
  }
  if (target?.kind === "post") {
    const data = asRecord(notification.data);
    const caption =
      captionSnippet(preview?.content) ??
      captionSnippet(stringField(data, "caption")) ??
      (notification.body && !POST_LIKE.test(notification.body) ? captionSnippet(notification.body) : null);
    const mediaType = preview?.media_type ?? stringField(data, "media_type");
    const thumbUrl = safeMediaUrl(preview?.media_url) ?? safeMediaUrl(stringField(data, "media_url"));
    const detail = caption && caption !== postLikeLine(notification) ? caption : null;
    return {
      title: postLikeLine(notification),
      detail,
      thumbUrl,
      thumbIsVideo: Boolean(thumbUrl && isVideo(mediaType, thumbUrl)),
    };
  }
  const detail = notification.body?.trim() || null;
  return {
    title: notification.title,
    detail: detail && detail !== notification.title ? detail : null,
    thumbUrl: null,
    thumbIsVideo: false,
  };
}

export function postLikeFields(preview?: {
  caption?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
}): { body?: string; data: Record<string, string> } {
  const caption = captionSnippet(preview?.caption);
  const mediaUrl = safeMediaUrl(preview?.mediaUrl);
  const mediaType = preview?.mediaType?.trim() || null;
  const data: Record<string, string> = {};
  if (caption) data.caption = caption;
  if (mediaUrl) data.media_url = mediaUrl;
  if (mediaType) data.media_type = mediaType;
  return caption ? { body: caption, data } : { data };
}

/** Live story ids include this one, so the viewer opens on it. Otherwise the profile. */
export function storyOpenPlan(
  liveStoryIds: string[],
  storyId: string,
  ownerId: string,
): { kind: "story"; initialStoryId: string } | { kind: "profile"; path: string } {
  if (liveStoryIds.includes(storyId)) return { kind: "story", initialStoryId: storyId };
  return { kind: "profile", path: `/profile/${ownerId}` };
}

export function storyStartIndex(stories: { id: string }[], initialStoryId?: string): number {
  if (!initialStoryId) return 0;
  const index = stories.findIndex((story) => story.id === initialStoryId);
  return index >= 0 ? index : 0;
}
