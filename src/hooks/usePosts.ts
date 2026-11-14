import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errorMessage';
import { shotContentThin, shotPosts, shotSessionEnabled } from '@/lib/shotSession';
import { isQueryablePostId } from '@/lib/postId';
import { assertCleanText } from '@/lib/objectionableText';
import { mergePostsAndReposts, repostQueryMissingCaption, type RepostRow } from '@/lib/sharing';
import { refreshXp } from '@/lib/xpRefresh';
import { queueMedia, usePendingUploads } from '@/lib/queuedMedia';
import { withPending } from '@/lib/pendingUploads';
import { embedColumnMissing, embedColumnsForInsert, videoEmbedMigrationMessage, type EmbedDraft, type StoredEmbedFields } from '@/lib/videoEmbed';
import { FEED_POST_LIMIT } from '@/lib/feedWindow';
import { abortAfter } from '@/lib/requestDeadline';
import type { RealtimeChannel } from '@supabase/supabase-js';

let postsFeedListeners = 0;
let postsFeedChannel: RealtimeChannel | null = null;

interface Post extends StoredEmbedFields {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: 'photo' | 'video' | 'text' | null;
  post_type: 'regular' | 'portfolio';
  created_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
    city: string | null;
    city_display: string | null;
  };
  reactions?: { emoji: string; count: number }[];
  user_reaction?: string | null;
  feed_key?: string;
  repost?: RepostRow | null;
  /** Set on a placeholder while its media is still uploading. */
  upload_job_id?: string;
}

export function usePosts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { blockedIds } = useUserBlocks();

  const { data: posts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['posts'],
    queryFn: async (): Promise<Post[]> => {
      if (shotSessionEnabled()) return (shotContentThin() ? [] : shotPosts()) as Post[];
      const signal = abortAfter();
      // Newest page only. The archive is not rendered in one pass on a phone.
      const { data: latestPosts, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(FEED_POST_LIMIT)
        .abortSignal(signal);

      if (error) throw error;
      let postsData = latestPosts ?? [];

      const primaryReposts = await supabase
        .from('reposts')
        .select('id, user_id, post_id, created_at, caption')
        .order('created_at', { ascending: false })
        .limit(FEED_POST_LIMIT)
        .abortSignal(signal);
      let repostData = primaryReposts.data as RepostRow[] | null;
      let repostError = primaryReposts.error;
      if (repostError && repostQueryMissingCaption(repostError.message)) {
        const legacyReposts = await supabase
          .from('reposts')
          .select('id, user_id, post_id, created_at')
          .order('created_at', { ascending: false })
          .limit(FEED_POST_LIMIT)
          .abortSignal(signal);
        repostData = legacyReposts.data as RepostRow[] | null;
        repostError = legacyReposts.error;
      }
      if (!repostError && repostData?.length) {
        const have = new Set(postsData.map((post) => post.id));
        const missingIds = [...new Set(repostData.map((row) => row.post_id))].filter(
          (id) => !have.has(id) && isQueryablePostId(id),
        );
        if (missingIds.length) {
          const { data: extraPosts } = await supabase
            .from('posts')
            .select('*')
            .in('id', missingIds)
            .abortSignal(signal);
          if (extraPosts?.length) postsData = [...postsData, ...extraPosts];
        }
      }

      // Get profiles for post creators
      const userIds = [...new Set(postsData?.map(p => p.user_id) || [])].filter(isQueryablePostId);
      let profiles: { user_id: string; display_name: string | null; avatar_url: string | null; city: string | null; city_display: string | null }[] = [];
      if (userIds.length) {
        const { data } = await supabase
          .from('profiles_public')
          .select('user_id, display_name, avatar_url, city, city_display')
          .in('user_id', userIds);
        profiles = data ?? [];
      }

      const profileMap = new Map(profiles.map(p => [p.user_id, p]));

      // Get reactions for each post. A non-uuid id makes the whole filter 400.
      const postIds = (postsData?.map(p => p.id) || []).filter(isQueryablePostId);
      let reactions: { post_id: string; emoji: string; user_id: string }[] = [];
      if (postIds.length) {
        const { data } = await supabase
          .from('post_reactions')
          .select('post_id, emoji, user_id')
          .in('post_id', postIds);
        reactions = data ?? [];
      }

      // Group reactions by post and emoji
      const reactionsByPost = new Map<string, Map<string, number>>();
      const userReactions = new Map<string, string>();

      reactions?.forEach(r => {
        if (!reactionsByPost.has(r.post_id)) {
          reactionsByPost.set(r.post_id, new Map());
        }
        const emojiMap = reactionsByPost.get(r.post_id)!;
        emojiMap.set(r.emoji, (emojiMap.get(r.emoji) || 0) + 1);

        if (user && r.user_id === user.id) {
          userReactions.set(r.post_id, r.emoji);
        }
      });

      const mapped = (postsData || []).map(post => ({
        ...post,
        post_type: post.post_type || 'regular',
        profile: profileMap.get(post.user_id),
        reactions: Array.from(reactionsByPost.get(post.id)?.entries() || []).map(([emoji, count]) => ({ emoji, count })),
        user_reaction: userReactions.get(post.id) || null,
        feed_key: post.id,
        repost: null,
      })) as Post[];

      if (repostError || !repostData?.length) return mapped;

      const reposterIds = [...new Set(repostData.map((row) => row.user_id))];
      const { data: reposterProfiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', reposterIds);
      const reposterMap = new Map((reposterProfiles ?? []).map((profile) => [profile.user_id, profile]));
      const reposts: RepostRow[] = repostData.map((row) => ({
        ...row,
        profile: reposterMap.get(row.user_id) ?? null,
      }));
      return mergePostsAndReposts(mapped, reposts);
    },
  });

  const createPost = useMutation({
    mutationFn: async ({ content, file, mediaType, embed }: { content?: string; file?: File; mediaType?: 'photo' | 'video' | 'text'; embed?: EmbedDraft; inlineError?: boolean }) => {
      if (!user) throw new Error('Must be logged in');
      assertCleanText(content);

      if (embed) {
        const columns = embedColumnsForInsert(embed);
        const { error: insertError } = await supabase
          .from('posts')
          .insert({
            user_id: user.id,
            content: content || null,
            ...columns,
          });
        if (insertError) throw insertError;
        return;
      }

      if (file && mediaType !== 'text') {
        // Media goes up in the background. The dialog closes now and the pill tracks it.
        queueMedia({
          queryClient,
          userId: user.id,
          kind: 'post',
          label: mediaType === 'video' ? 'Video post' : 'Photo post',
          files: [file],
          mediaType: mediaType === 'video' ? 'video' : 'photo',
          content: content || null,
          insert: async ([mediaUrl]) => {
            const { error: insertError } = await supabase
              .from('posts')
              .insert({
                user_id: user.id,
                content: content || null,
                media_url: mediaUrl,
                media_type: mediaType || 'photo',
              });
            if (insertError) throw insertError;
            refreshXp(queryClient);
          },
          invalidate: [['posts'], ['profile-posts']],
          successMessage: 'Post shared',
        });
        return { queued: true as const };
      }

      const { data: inserted, error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content || null,
          media_url: null,
          media_type: 'text',
        })
        .select('id, created_at')
        .single();

      if (insertError) throw insertError;
      return { id: inserted.id, created_at: inserted.created_at };
    },
    onSuccess: (result) => {
      if (result && 'queued' in result) return;
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      refreshXp(queryClient);
      toast.success('Post created!');
    },
    onError: (error, vars) => {
      if (vars.inlineError) return;
      toast.error(embedColumnMissing(error)
        ? videoEmbedMigrationMessage()
        : errorMessage(error, 'Failed to create post'));
      console.error(error);
    },
  });

  useEffect(() => {
    postsFeedListeners += 1;
    if (postsFeedListeners === 1) {
      postsFeedChannel = supabase
        .channel('posts-feed')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
          queryClient.invalidateQueries({ queryKey: ['posts'] });
        })
        .subscribe();
    }
    return () => {
      postsFeedListeners -= 1;
      if (postsFeedListeners === 0 && postsFeedChannel) {
        supabase.removeChannel(postsFeedChannel);
        postsFeedChannel = null;
      }
    };
  }, [queryClient]);

  const addReaction = useMutation({
    mutationFn: async ({ postId, emoji }: { postId: string; emoji: string }) => {
      if (!user) throw new Error('Must be logged in');

      // Check if user already has a reaction
      const { data: existing } = await supabase
        .from('post_reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Remove existing reaction if same emoji, otherwise update
        await supabase
          .from('post_reactions')
          .delete()
          .eq('id', existing.id);
      }

      // Add new reaction
      await supabase
        .from('post_reactions')
        .insert({
          post_id: postId,
          user_id: user.id,
          emoji,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  const removeReaction = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error('Must be logged in');

      await supabase
        .from('post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      toast.success('Post deleted');
    },
    onError: () => {
      toast.error('Failed to delete post');
    },
  });

  const pending = usePendingUploads();
  const visiblePosts = useMemo(
    () => withPending(
      posts.filter((post) => !blockedIds.includes(post.user_id) && !blockedIds.includes(post.repost?.user_id ?? '')),
      pending,
      'post',
      (item): Post => ({
        id: item.id,
        user_id: item.userId,
        content: item.content,
        media_url: item.mediaUrl,
        media_type: item.mediaType,
        post_type: 'regular',
        created_at: item.createdAt,
        profile: posts.find((post) => post.user_id === item.userId && post.profile)?.profile
          ?? { display_name: 'You', avatar_url: null, city: null, city_display: null },
        reactions: [],
        user_reaction: null,
        upload_job_id: item.jobId,
      }),
    ),
    [posts, blockedIds, pending],
  );

  return {
    posts: visiblePosts,
    isLoading,
    isError,
    createPost,
    addReaction,
    removeReaction,
    deletePost,
    refetch,
  };
}
