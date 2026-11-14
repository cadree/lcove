import type { QueryClient } from "@tanstack/react-query";

/**
 * Mark the XP queries stale. The refetch runs in the background and does not
 * block the feed render that just succeeded.
 */
export function refreshXp(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["novi-board"] });
  void queryClient.invalidateQueries({ queryKey: ["my-xp"] });
}
