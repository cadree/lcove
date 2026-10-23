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
import { embedColumnMissing, embedColumnsForInsert, videoEmbedMigrationMessage, type EmbedDraft, type StoredEmbedFields } from '@/lib/videoEmbed';
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
}

export function usePosts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { blockedIds } = useUserBlocks();

  const { data: posts = [], isLoading, refetch } = useQuery({
    queryKey: ['posts'],
    queryFn: async (): Promise<Post[]> => {
      if (shotSessionEnabled()) return (shotContentThin() ? [] : shotPosts()) as Post[];
      // Get all posts, ordered chronologically (newest first)
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

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

      const primaryReposts = await supabase
        .from('reposts')
        .select('id, user_id, post_id, created_at, caption')
        .order('created_at', { ascending: false })
        .limit(200);
      let repostData = primaryReposts.data as RepostRow[] | null;
      let repostError = primaryReposts.error;
      if (repostError && repostQueryMissingCaption(repostError.message)) {
        const legacyReposts = await supabase
          .from('reposts')
          .select('id, user_id, post_id, created_at')
          .order('created_at', { ascending: false })
          .limit(200);
        repostData = legacyReposts.data as RepostRow[] | null;
        repostError = legacyReposts.error;
      }
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
    mutationFn: async ({ content, file, mediaType, embed }: { content?: string; file?: File; mediaType?: 'photo' | 'video' | 'text'; embed?: EmbedDraft }) => {
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

      let mediaUrl: string | null = null;

      if (file && mediaType !== 'text') {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content || null,
          media_url: mediaUrl,
          media_type: mediaType || 'text',
        })
        .select('id, created_at')
        .single();

      if (insertError) throw insertError;
      return { id: inserted.id, created_at: inserted.created_at, mediaUrl };
    },
    onMutate: async ({ content, file, mediaType }) => {
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      const previous = queryClient.getQueryData<Post[]>(['posts']);
      const preview = file ? URL.createObjectURL(file) : null;
      const optimistic: Post = {
        id: `optimistic-${Date.now()}`,
        user_id: user.id,
        content: content || null,
        media_url: preview,
        media_type: mediaType || 'text',
        post_type: 'regular',
        created_at: new Date().toISOString(),
        reactions: [],
        user_reaction: null,
      };
      queryClient.setQueryData<Post[]>(['posts'], (current) => [optimistic, ...(current ?? [])]);
      return { previous, preview };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      refreshXp(queryClient);
      toast.success('Post created!');
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['posts'], context.previous);
      if (context?.preview) URL.revokeObjectURL(context.preview);
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

  const visiblePosts = useMemo(
    () => posts.filter((post) => !blockedIds.includes(post.user_id) && !blockedIds.includes(post.repost?.user_id ?? '')),
    [posts, blockedIds],
  );

  return {
    posts: visiblePosts,
    isLoading,
    createPost,
    addReaction,
    removeReaction,
    deletePost,
    refetch,
  };
}
