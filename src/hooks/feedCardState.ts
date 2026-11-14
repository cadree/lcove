import { useContext } from "react";
import { FeedEngagementContext } from "@/hooks/feedEngagementContext";

export function useFeedCardState(postId: string) {
  const context = useContext(FeedEngagementContext);
  if (!context) {
    throw new Error("Feed cards read likes from FeedEngagementProvider");
  }
  const like = context.likes[postId] ?? { count: 0, hasLiked: false };
  return {
    likesCount: like.count,
    hasLiked: like.hasLiked,
    isSaved: context.saved.has(postId),
    likesError: context.likesError,
    toggleLike: context.toggleLike,
    toggleSave: context.toggleSave,
    isLiking: context.likingId === postId,
    isSaving: context.savingId === postId,
  };
}
