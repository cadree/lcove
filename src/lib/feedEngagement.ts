export type LikeRow = { post_id: string; user_id: string };

export type LikeTally = Record<string, { count: number; hasLiked: boolean }>;

/** Group one batched post_likes read into per-post counts. */
export function tallyPostLikes(rows: LikeRow[], userId: string | undefined): LikeTally {
  const likes: LikeTally = {};
  for (const row of rows) {
    const current = likes[row.post_id] ?? { count: 0, hasLiked: false };
    current.count += 1;
    if (userId && row.user_id === userId) current.hasLiked = true;
    likes[row.post_id] = current;
  }
  return likes;
}

export function savedIdSet(rows: { post_id: string }[]): Set<string> {
  return new Set(rows.map((row) => row.post_id));
}
