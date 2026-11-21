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
  saved: Set<string>;
  likesError: string | null;
  toggleLike: (post: LikeTarget) => void;
  toggleSave: (postId: string) => void;
  likingId: string | null;
  savingId: string | null;
};

export const FeedEngagementContext = createContext<FeedEngagementValue | null>(null);
