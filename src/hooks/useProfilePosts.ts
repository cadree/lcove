import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ProfilePost } from '@/types/post';

export function useProfilePosts(userId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const targetUserId = userId || user?.id;

  const { data: posts = [], isLoading, refetch } = useQuery({
    queryKey: ['profile-posts', targetUserId],
    queryFn: async (): Promise<ProfilePost[]> => {
      if (!targetUserId) return [];

      // Get posts for the user
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get profile for the user
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('user_id', targetUserId)
        .single();

      return (postsData || []).map(post => ({
        id: post.id,
        user_id: post.user_id,
        content: post.content,
        media_url: post.media_url,
        media_type: post.media_type,
        created_at: post.created_at,
        location: post.location ?? null,
        collaborators: post.collaborators ?? null,
        alt_text: post.alt_text ?? null,
        comments_enabled: post.comments_enabled ?? true,
        folder_id: post.folder_id ?? null,
        profile: profile || { display_name: null, avatar_url: null },
      }));
    },
    enabled: !!targetUserId,
  });

  const createPost = useMutation({
    mutationFn: async ({ 
      content, 
      file, 
      mediaType,
      location,
      altText,
      commentsEnabled = true,
    }: { 
      content?: string; 
      file?: File; 
      mediaType?: 'photo' | 'video' | 'text';
      location?: string;
      altText?: string;
      commentsEnabled?: boolean;
    }) => {
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
          location: location || null,
          alt_text: altText || null,
          comments_enabled: commentsEnabled,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-posts', targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] }); // Also refresh global feed
      toast.success('Post shared!');
    },
    onError: (error) => {
      toast.error('Failed to share post');
      console.error(error);
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
      queryClient.invalidateQueries({ queryKey: ['profile-posts', targetUserId] });
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
    deletePost,
    refetch,
  };
}
