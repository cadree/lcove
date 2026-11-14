export interface BrowseReel {
  id: string;
  userId: string;
  name: string;
  mediaUrl: string;
}

interface PostLike {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: string | null;
  post_type?: string | null;
  content?: string | null;
  profile?: { display_name?: string | null } | null;
  upload_job_id?: string | null;
}

/** Video posts only. Stories are 24-hour moments and never appear as reels. */
export function collectReels(posts: PostLike[]): BrowseReel[] {
  return posts
    .filter((post) => post.media_type === "video" && post.media_url && !post.upload_job_id)
    .map((post) => ({
      id: `post-${post.id}`,
      userId: post.user_id,
      name: post.profile?.display_name || "Member",
      mediaUrl: post.media_url as string,
    }));
}

export function browsePosts<T extends { post_type?: string | null }>(posts: T[], lane: "posts" | "portfolios") {
  return posts.filter((post) =>
    lane === "portfolios" ? post.post_type === "portfolio" : post.post_type !== "portfolio",
  );
}

export function matchesBrowseQuery(name: string | null | undefined, content: string | null | undefined, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (name || "").toLowerCase().includes(needle) || (content || "").toLowerCase().includes(needle);
}

export function growVisibleCount(current: number, total: number, pageSize: number) {
  if (total <= 0) return 0;
  if (current >= total) return current + pageSize;
  return Math.min(total, current + pageSize);
}
