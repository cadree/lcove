import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { toast } from 'sonner';
import { ProfilePost } from '@/types/post';
import { profileItemsWithReposts, type RepostRow } from '@/lib/sharing';

export function useProfilePosts(userId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const targetUserId = userId || user?.id;
  const { isBlocked } = useUserBlocks();

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

      // Get profile for the user using profiles_public view
      const { data: profileRows } = await supabase
        .from('profiles_public')
        .select('display_name, avatar_url')
        .eq('user_id', targetUserId)
        .limit(1);
      const profile = profileRows?.[0];

      const toProfilePost = (
        post: (typeof postsData)[number],
        author: { display_name: string | null; avatar_url: string | null },
      ): ProfilePost => ({
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
        profile: author,
      });

      const own = (postsData || []).map((post) => toProfilePost(post, profile || { display_name: null, avatar_url: null }));

      const { data: repostData, error: repostError } = await supabase
        .from('reposts')
        .select('id, user_id, post_id, created_at')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });
      if (repostError || !repostData?.length) {
        return own.map((post) => ({ ...post, grid_key: post.id, repost: null }));
      }

      const originalIds = [...new Set(repostData.map((row) => row.post_id))];
      const { data: originals, error: originalsError } = await supabase
        .from('posts')
        .select('*')
        .in('id', originalIds);
      if (originalsError || !originals?.length) {
        return own.map((post) => ({ ...post, grid_key: post.id, repost: null }));
      }

      const authorIds = [...new Set(originals.map((post) => post.user_id))];
      const { data: authors } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', authorIds);
      const authorMap = new Map((authors ?? []).map((author) => [author.user_id, author]));
      const reposter = profile || { display_name: null, avatar_url: null };
      const reposts: RepostRow[] = repostData.map((row) => ({
        ...row,
        profile: { display_name: reposter.display_name, avatar_url: reposter.avatar_url },
      }));

      return profileItemsWithReposts(
        own,
        reposts,
        originals.map((post) => toProfilePost(post, authorMap.get(post.user_id) || { display_name: null, avatar_url: null })),
      );
    },
    enabled: !!targetUserId,
    staleTime: 0,
  });

  const createPost = useMutation({
    mutationFn: async ({ 
      content, 
      file,
      files,
      mediaType,
      location,
      altText,
      commentsEnabled = true,
    }: { 
      content?: string; 
      file?: File;
      files?: File[];
      mediaType?: 'photo' | 'video' | 'text' | 'collage';
      location?: string;
      altText?: string;
      commentsEnabled?: boolean;
    }) => {
      if (!user) throw new Error('Must be logged in');

      let mediaUrl: string | null = null;
      let additionalMediaUrls: string[] = [];

      // Handle single file upload
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

      // Handle multiple files for collage
      if (files && files.length > 0 && mediaType === 'collage') {
        const uploadPromises = files.map(async (f, index) => {
          const fileExt = f.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}_${index}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(fileName, f);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('media')
            .getPublicUrl(fileName);

          return publicUrl;
        });

        const uploadedUrls = await Promise.all(uploadPromises);
        mediaUrl = uploadedUrls[0]; // First image as primary
        additionalMediaUrls = uploadedUrls.slice(1);
      }

      // For collage, store as 'photo' type since the DB constraint only allows 'photo', 'video', 'text'
      const dbMediaType = mediaType === 'collage' ? 'photo' : (mediaType || 'text');

      const { error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content || null,
          media_url: mediaUrl,
          media_type: dbMediaType,
          location: location || null,
          alt_text: altText || null,
          comments_enabled: commentsEnabled,
          // Store additional URLs in content as JSON if collage (temporary solution)
          // In future, could add a separate 'media_urls' column
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

  const visiblePosts = targetUserId && targetUserId !== user?.id && isBlocked(targetUserId) ? [] : posts;

  return {
    posts: visiblePosts,
    isLoading,
    createPost,
    deletePost,
    refetch,
  };
}
