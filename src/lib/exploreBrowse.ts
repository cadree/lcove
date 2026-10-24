export interface BrowseReel {
  id: string;
  userId: string;
  name: string;
  mediaUrl: string;
  source: "story" | "post";
}

interface StoryLike {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  profile?: { display_name?: string | null } | null;
}

interface PostLike {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: string | null;
  post_type?: string | null;
  content?: string | null;
  profile?: { display_name?: string | null } | null;
}

export function collectReels(stories: StoryLike[], posts: PostLike[]): BrowseReel[] {
  const fromStories = stories
    .filter((story) => story.media_type === "video" && story.media_url)
    .map((story) => ({
      id: `story-${story.id}`,
      userId: story.user_id,
      name: story.profile?.display_name || "Member",
      mediaUrl: story.media_url,
      source: "story" as const,
    }));
  const fromPosts = posts
    .filter((post) => post.media_type === "video" && post.media_url)
    .map((post) => ({
      id: `post-${post.id}`,
      userId: post.user_id,
      name: post.profile?.display_name || "Member",
      mediaUrl: post.media_url as string,
      source: "post" as const,
    }));
  return [...fromStories, ...fromPosts];
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
