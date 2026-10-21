import { embedColumnMissing, embedFromPost, type StoredEmbedFields } from "./videoEmbed.ts";

export interface ProfileGridPost extends StoredEmbedFields {
  media_url?: string | null;
  content?: string | null;
}

export const PROFILE_POST_COLUMNS_BASE =
  "id, user_id, content, media_url, media_type, created_at, location, collaborators, alt_text, comments_enabled, folder_id";

export const PROFILE_POST_COLUMNS =
  `${PROFILE_POST_COLUMNS_BASE}, embed_provider, embed_video_id, embed_hash, embed_thumbnail_url, embed_title`;

export interface ProfilePostRow extends StoredEmbedFields {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  location?: string | null;
  collaborators?: string[] | null;
  alt_text?: string | null;
  comments_enabled?: boolean | null;
  folder_id?: string | null;
}

/** Profile posts include caption-only posts and video-link posts. media_url is not required. */
export function postsForProfileGrid<T extends ProfileGridPost>(posts: T[]): T[] {
  return posts.filter((post) => Boolean(post.media_url) || Boolean(post.content?.trim()) || embedFromPost(post) !== null);
}

export function sameUserId(a?: string | null, b?: string | null): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

/**
 * A block hides someone else's posts. It must not wipe the signed-in user's own profile,
 * or the header stays at 0 and a ?post= link has nothing to open.
 */
export function postsForViewer<T>(
  posts: T[],
  viewerId: string | null | undefined,
  profileUserId: string | null | undefined,
  blocked: boolean,
): T[] {
  if (sameUserId(viewerId, profileUserId)) return posts;
  if (blocked) return [];
  return posts;
}

/** The post from ?post= still counts when the profile list omitted it. */
export function mergeLinkedPost<T extends { id: string; user_id?: string | null }>(
  posts: T[],
  linked: T | null | undefined,
  profileUserId?: string | null,
): T[] {
  if (!linked?.id || !sameUserId(linked.user_id, profileUserId)) return posts;
  if (posts.some((post) => post.id === linked.id)) return posts;
  return [linked, ...posts];
}

export function profilePostFromRow(
  post: ProfilePostRow,
  author?: { display_name: string | null; avatar_url: string | null } | null,
) {
  return {
    id: post.id,
    user_id: post.user_id,
    content: post.content,
    media_url: post.media_url,
    media_type: post.media_type,
    created_at: post.created_at,
    location: post.location ?? null,
    collaborators: post.collaborators ?? null,
    alt_text: post.alt_text ?? null,
    comments_enabled: post.comments_enabled ?? true,
    folder_id: post.folder_id ?? null,
    embed_provider: post.embed_provider ?? null,
    embed_video_id: post.embed_video_id ?? null,
    embed_hash: post.embed_hash ?? null,
    embed_thumbnail_url: post.embed_thumbnail_url ?? null,
    embed_title: post.embed_title ?? null,
    profile: author ?? { display_name: null, avatar_url: null },
    grid_key: post.id,
    repost: null as null,
  };
}

type ProfileColumnResult<T> = {
  data: T;
  error: { message: string } | null;
};

/** Prefer embed columns, and fall back when that migration is not applied yet. */
export async function withProfilePostColumns<T>(
  run: (columns: string) => PromiseLike<ProfileColumnResult<T>>,
): Promise<ProfileColumnResult<T>> {
  const full = await run(PROFILE_POST_COLUMNS);
  if (!full.error || !embedColumnMissing(full.error)) return full;
  return run(PROFILE_POST_COLUMNS_BASE);
}
