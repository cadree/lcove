import { embedFromPost, type StoredEmbedFields } from "./videoEmbed.ts";

export interface ProfileGridPost extends StoredEmbedFields {
  media_url?: string | null;
  content?: string | null;
}

/** Profile posts include caption-only posts and video-link posts. media_url is not required. */
export function postsForProfileGrid<T extends ProfileGridPost>(posts: T[]): T[] {
  return posts.filter((post) => Boolean(post.media_url) || Boolean(post.content?.trim()) || embedFromPost(post) !== null);
}
