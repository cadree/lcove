export interface ProfileGridPost {
  media_url?: string | null;
  content?: string | null;
}

export const PROFILE_POST_COLUMNS =
  "id, user_id, content, media_url, media_type, created_at, location, collaborators, alt_text, comments_enabled, folder_id";

export interface ProfilePostRow {
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

/** Profile posts include caption-only posts. media_url is not required. */
export function postsForProfileGrid<T extends ProfileGridPost>(posts: T[]): T[] {
  return posts.filter((post) => Boolean(post.media_url) || Boolean(post.content?.trim()));
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
    profile: author ?? { display_name: null, avatar_url: null },
    grid_key: post.id,
    repost: null as null,
  };
}
