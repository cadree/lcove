import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { toast } from 'sonner';
import { notifyPostComment, notifyPostLike } from '@/lib/notifications';

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  replies?: Comment[];
}

export function usePostInteractions(postId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { blockedIds } = useUserBlocks();
  const canQuery = postId.trim().length > 0;

  // Fetch likes count and user's like status
  const { data: likesData, refetch: refetchLikes } = useQuery({
    queryKey: ['post-likes', postId],
    enabled: canQuery,
    queryFn: async () => {
      const { count } = await supabase
        .from('post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);

      let hasLiked = false;
      if (user) {
        const { data } = await supabase
          .from('post_likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle();
        hasLiked = !!data;
      }

      return { count: count || 0, hasLiked };
    },
  });

  // Fetch comments with profiles
  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ['post-comments', postId],
    enabled: canQuery,
    queryFn: async () => {
      const { data: commentsData, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get profiles for commenters
      const userIds = [...new Set(commentsData?.map(c => c.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]));

      // Add profiles to comments. A missing row is a private profile.
      const commentsWithProfiles = (commentsData || []).map(c => ({
        ...c,
        profile: profileMap.get(c.user_id),
      }));

      // Build thread structure
      const rootComments: Comment[] = [];
      const commentMap = new Map<string, Comment>();

      commentsWithProfiles.forEach(c => {
        commentMap.set(c.id, { ...c, replies: [] });
      });

      commentsWithProfiles.forEach(c => {
        const comment = commentMap.get(c.id)!;
        if (c.parent_id && commentMap.has(c.parent_id)) {
          commentMap.get(c.parent_id)!.replies!.push(comment);
        } else {
          rootComments.push(comment);
        }
      });

      return rootComments;
    },
  });

  // Check if post is saved
  const { data: isSaved = false, refetch: refetchSaved } = useQuery({
    queryKey: ['post-saved', postId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('saved_posts')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: canQuery && !!user,
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Must be logged in');

      if (likesData?.hasLiked) {
        // Unlike
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        // Like
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id });

        const { data: post } = await supabase
          .from('posts')
          .select('user_id, content, media_url, media_type')
          .eq('id', postId)
          .maybeSingle();
        if (post && post.user_id !== user.id) {
          const { data: profile } = await supabase
            .from('profiles_public')
            .select('display_name')
            .eq('user_id', user.id)
            .maybeSingle();
          notifyPostLike(post.user_id, profile?.display_name || 'Someone', postId, {
            caption: post.content,
            mediaUrl: post.media_url,
            mediaType: post.media_type,
          }).catch(() => undefined);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-likes', postId] });
    },
  });

  // Comment mutation
  const commentMutation = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: string }) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content,
          parent_id: parentId || null,
        });

      if (error) throw error;

      const { data: post } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .maybeSingle();
      if (post && post.user_id !== user.id) {
        const { data: profile } = await supabase
          .from('profiles_public')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle();
        notifyPostComment(post.user_id, profile?.display_name || 'Someone', postId).catch(() => undefined);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      toast.success('Comment added');
    },
    onError: () => {
      toast.error('Failed to add comment');
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      toast.success('Comment deleted');
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Must be logged in');

      if (isSaved) {
        await supabase
          .from('saved_posts')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('saved_posts')
          .insert({ post_id: postId, user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-saved', postId, user?.id] });
      toast.success(isSaved ? 'Removed from saved' : 'Saved');
    },
  });

  // Real-time subscriptions
  useEffect(() => {
    if (!canQuery) return;

    const likesChannel = supabase
      .channel(`post-likes-${postId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_likes', filter: `post_id=eq.${postId}` },
        () => refetchLikes()
      )
      .subscribe();

    const commentsChannel = supabase
      .channel(`post-comments-${postId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
        () => refetchComments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [canQuery, postId, refetchLikes, refetchComments]);

  const visibleComments = useMemo(
    () => hideBlockedComments(comments, new Set(blockedIds)),
    [comments, blockedIds],
  );

  return {
    likesCount: likesData?.count || 0,
    hasLiked: likesData?.hasLiked || false,
    comments: visibleComments,
    commentsCount: countComments(visibleComments),
    isSaved,
    toggleLike: () => likeMutation.mutate(),
    addComment: (content: string, parentId?: string) => commentMutation.mutate({ content, parentId }),
    deleteComment: (commentId: string) => deleteCommentMutation.mutate(commentId),
    toggleSave: () => saveMutation.mutate(),
    isLiking: likeMutation.isPending,
    isCommenting: commentMutation.isPending,
    isSaving: saveMutation.isPending,
  };
}

function hideBlockedComments(comments: Comment[], blocked: Set<string>): Comment[] {
  const visible: Comment[] = [];
  for (const comment of comments) {
    const replies = hideBlockedComments(comment.replies ?? [], blocked);
    if (blocked.has(comment.user_id)) {
      visible.push(...replies);
    } else {
      visible.push({ ...comment, replies });
    }
  }
  return visible;
}

function countComments(comments: Comment[]): number {
  return comments.reduce((acc, comment) => acc + 1 + countComments(comment.replies ?? []), 0);
}
