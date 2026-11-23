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

/**
 * Who liked each post most recently, for the small avatars on a post card. Rows
 * arrive newest first; the viewer is left out so the faces are other people.
 */
export function recentLikers(rows: LikeRow[], viewerId: string | undefined, limit = 3): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const row of rows) {
    if (row.user_id === viewerId) continue;
    const list = out[row.post_id] ?? (out[row.post_id] = []);
    if (list.length < limit && !list.includes(row.user_id)) list.push(row.user_id);
  }
  return out;
}

/** Visible comments per post from one batched read. */
export function tallyComments(rows: { post_id: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) out[row.post_id] = (out[row.post_id] ?? 0) + 1;
  return out;
}

/** Compact counts for the glass pill on a post card: 950, 1.2k, 12k. */
export function compactCount(value: number): string {
  if (value < 1000) return String(Math.max(0, value));
  const k = value / 1000;
  return `${k < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.round(k)}k`;
}
