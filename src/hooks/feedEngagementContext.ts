import { createContext } from "react";
import type { LikeTally } from "@/lib/feedEngagement";

export type LikeTarget = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
};

export type FeedEngagementValue = {
  likes: LikeTally;
  /** Newest other likers per post, up to three. */
  likers: Record<string, string[]>;
  reactors: Record<string, { name: string; avatarUrl: string | null }>;
  /** Visible comments per post. */
  comments: Record<string, number>;
  saved: Set<string>;
  likesError: string | null;
  toggleLike: (post: LikeTarget) => void;
  toggleSave: (postId: string) => void;
  likingId: string | null;
  savingId: string | null;
};

export const FeedEngagementContext = createContext<FeedEngagementValue | null>(null);
