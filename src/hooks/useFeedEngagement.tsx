import { useEffect, useMemo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isQueryablePostId } from "@/lib/postId";
import { savedIdSet, tallyPostLikes, type LikeTally } from "@/lib/feedEngagement";
import { notifyPostLike } from "@/lib/notifications";
import { toast } from "sonner";
import { FeedEngagementContext, type FeedEngagementValue, type LikeTarget } from "@/hooks/feedEngagementContext";

const CHUNK = 80;

async function selectChunks<T>(
  ids: string[],
  run: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += CHUNK) {
    const { data, error } = await run(ids.slice(index, index + CHUNK));
    if (error) throw new Error(error.message);
    if (data?.length) rows.push(...data);
  }
  return rows;
}

export function FeedEngagementProvider({ postIds, children }: { postIds: string[]; children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const idKey = [...new Set(postIds.filter(isQueryablePostId))].sort().join(",");
  const ids = useMemo(() => (idKey ? idKey.split(",") : []), [idKey]);

  const likesQuery = useQuery({
    queryKey: ["feed-likes", user?.id ?? null, idKey],
    enabled: ids.length > 0,
    queryFn: async () => {
      const rows = await selectChunks<{ post_id: string; user_id: string }>(ids, (chunk) =>
        supabase.from("post_likes").select("post_id, user_id").in("post_id", chunk),
      );
      return tallyPostLikes(rows, user?.id);
    },
  });

  const savesQuery = useQuery({
    queryKey: ["feed-saves", user?.id ?? null, idKey],
    enabled: ids.length > 0 && !!user,
    queryFn: async () => {
      const rows = await selectChunks<{ post_id: string }>(ids, (chunk) =>
        supabase.from("saved_posts").select("post_id").eq("user_id", user!.id).in("post_id", chunk),
      );
      return [...savedIdSet(rows)];
    },
  });

  useEffect(() => {
    if (!ids.length) return;
    const watching = new Set(ids);
    const channel = supabase
      .channel("feed-engagement")
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, (payload) => {
        const row = (payload.new ?? payload.old) as { post_id?: string } | null;
        if (!row?.post_id || watching.has(row.post_id)) {
          queryClient.invalidateQueries({ queryKey: ["feed-likes"] });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "saved_posts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["feed-saves"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [idKey, ids, queryClient]);

  const likeMutation = useMutation({
    mutationFn: async (post: LikeTarget) => {
      if (!user) throw new Error("Must be logged in");
      const hasLiked = likesQuery.data?.[post.id]?.hasLiked ?? false;
      if (hasLiked) {
        const { error } = await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
      if (error) throw error;
      if (post.user_id === user.id) return;
      const { data: profile } = await supabase
        .from("profiles_public")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      notifyPostLike(post.user_id, profile?.display_name || "Someone", post.id, {
        caption: post.content,
        mediaUrl: post.media_url,
        mediaType: post.media_type,
      }).catch(() => undefined);
    },
    onMutate: async (post) => {
      await queryClient.cancelQueries({ queryKey: ["feed-likes"] });
      const previous = queryClient.getQueriesData<LikeTally>({ queryKey: ["feed-likes"] });
      queryClient.setQueriesData<LikeTally>({ queryKey: ["feed-likes"] }, (current) => {
        if (!current) return current;
        const row = current[post.id] ?? { count: 0, hasLiked: false };
        const hasLiked = !row.hasLiked;
        return {
          ...current,
          [post.id]: { count: Math.max(0, row.count + (hasLiked ? 1 : -1)), hasLiked },
        };
      });
      return { previous };
    },
    onError: (_error, _post, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: (_data, _error, post) => {
      queryClient.invalidateQueries({ queryKey: ["feed-likes"] });
      queryClient.invalidateQueries({ queryKey: ["post-likes", post.id] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error("Must be logged in");
      const saved = new Set(savesQuery.data ?? []);
      if (saved.has(postId)) {
        const { error } = await supabase.from("saved_posts").delete().eq("post_id", postId).eq("user_id", user.id);
        if (error) throw error;
        toast.success("Removed from saved");
        return;
      }
      const { error } = await supabase.from("saved_posts").insert({ post_id: postId, user_id: user.id });
      if (error) throw error;
      toast.success("Saved");
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["feed-saves"] });
      const previous = queryClient.getQueriesData<string[]>({ queryKey: ["feed-saves"] });
      queryClient.setQueriesData<string[]>({ queryKey: ["feed-saves"] }, (current) => {
        if (!current) return current;
        return current.includes(postId) ? current.filter((id) => id !== postId) : [...current, postId];
      });
      return { previous };
    },
    onError: (_error, _postId, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-saves"] });
    },
  });

  useEffect(() => {
    if (likesQuery.error) console.error("[feed] post_likes batch failed", likesQuery.error);
  }, [likesQuery.error]);

  const saved = useMemo(() => new Set(savesQuery.data ?? []), [savesQuery.data]);

  const value = useMemo<FeedEngagementValue>(
    () => ({
      likes: likesQuery.data ?? {},
      saved,
      likesError: likesQuery.error instanceof Error ? likesQuery.error.message : likesQuery.error ? "Likes did not load" : null,
      toggleLike: (post) => likeMutation.mutate(post),
      toggleSave: (postId) => saveMutation.mutate(postId),
      likingId: likeMutation.isPending ? likeMutation.variables?.id ?? null : null,
      savingId: saveMutation.isPending ? saveMutation.variables ?? null : null,
    }),
    [likesQuery.data, likesQuery.error, saved, likeMutation, saveMutation],
  );

  return <FeedEngagementContext.Provider value={value}>{children}</FeedEngagementContext.Provider>;
}
