export interface ProfileGridPost {
  media_url?: string | null;
  content?: string | null;
}

/** Profile posts include caption-only posts. media_url is not required. */
export function postsForProfileGrid<T extends ProfileGridPost>(posts: T[]): T[] {
  return posts.filter((post) => Boolean(post.media_url) || Boolean(post.content?.trim()));
}
