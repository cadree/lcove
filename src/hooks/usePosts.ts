import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Post {
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
}

export function usePosts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading, refetch } = useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      // Get all posts, ordered chronologically (newest first)
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get profiles for post creators using profiles_public view to protect sensitive fields
      const userIds = [...new Set(postsData?.map(p => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url, city, city_display')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]));

      // Get reactions for each post
      const postIds = postsData?.map(p => p.id) || [];
      const { data: reactions } = await supabase
        .from('post_reactions')
        .select('post_id, emoji, user_id')
        .in('post_id', postIds);

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

      return (postsData || []).map(post => ({
        ...post,
        post_type: post.post_type || 'regular',
        profile: profileMap.get(post.user_id) || { display_name: null, avatar_url: null, city: null, city_display: null },
        reactions: Array.from(reactionsByPost.get(post.id)?.entries() || []).map(([emoji, count]) => ({ emoji, count })),
        user_reaction: userReactions.get(post.id) || null,
      })) as Post[];
    },
  });

  const createPost = useMutation({
    mutationFn: async ({ content, file, mediaType }: { content?: string; file?: File; mediaType?: 'photo' | 'video' | 'text' }) => {
      if (!user) throw new Error('Must be logged in');

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

      const { error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content || null,
          media_url: mediaUrl,
          media_type: mediaType || 'text',
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post created!');
    },
    onError: (error) => {
      toast.error('Failed to create post');
      console.error(error);
    },
  });

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
      toast.success('Post deleted');
    },
    onError: () => {
      toast.error('Failed to delete post');
    },
  });

  return {
    posts,
    isLoading,
    createPost,
    addReaction,
    removeReaction,
    deletePost,
    refetch,
  };
}
