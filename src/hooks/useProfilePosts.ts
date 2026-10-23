import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errorMessage';
import { ProfilePost } from '@/types/post';
import { profileItemsWithReposts, type RepostRow } from '@/lib/sharing';
import {
  postsForViewer,
  profilePostFromRow,
  withProfilePostColumns,
  type ProfilePostRow,
} from '@/lib/profilePosts';
import { embedColumnMissing, embedColumnsForInsert, videoEmbedMigrationMessage, type EmbedDraft } from '@/lib/videoEmbed';
import { shotEmbedEnabled, shotEmbedPost } from '@/lib/shotSession';

const EMPTY_POSTS: ProfilePost[] = [];

export function useProfilePosts(userId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const targetUserId = userId || user?.id;
  const { isBlocked } = useUserBlocks();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['profile-posts', targetUserId],
    queryFn: async (): Promise<ProfilePost[]> => {
      const profileUserId = targetUserId;
      if (!profileUserId) return [];

      if (shotEmbedEnabled() && targetUserId === shotEmbedPost().user_id) {
        const post = shotEmbedPost();
        return [{
          id: post.id,
          user_id: post.user_id,
          content: post.content,
          media_url: post.media_url,
          media_type: post.media_type,
          created_at: post.created_at,
          location: post.location,
          collaborators: post.collaborators,
          alt_text: post.alt_text,
          comments_enabled: post.comments_enabled,
          folder_id: post.folder_id,
          embed_provider: post.embed_provider,
          embed_video_id: post.embed_video_id,
          embed_hash: post.embed_hash,
          embed_thumbnail_url: post.embed_thumbnail_url,
          embed_title: post.embed_title,
          profile: { display_name: post.profile.display_name, avatar_url: null },
          grid_key: post.id,
          repost: null,
        }];
      }

      const { data: postsData, error } = await withProfilePostColumns((columns) =>
        supabase
          .from('posts')
          .select(columns)
          .eq('user_id', profileUserId)
          .order('created_at', { ascending: false }),
      );

      if (error) throw error;

      const { data: profileRows } = await supabase
        .from('profiles_public')
        .select('display_name, avatar_url')
        .eq('user_id', profileUserId)
        .limit(1);
      const author = profileRows?.[0] || { display_name: null, avatar_url: null };
      const ownRows = (postsData || []) as unknown as ProfilePostRow[];
      const own = ownRows.map((post) => profilePostFromRow(post, author));

      try {
        const { data: repostData, error: repostError } = await supabase
          .from('reposts')
          .select('id, user_id, post_id, created_at')
          .eq('user_id', profileUserId)
          .order('created_at', { ascending: false });
        if (repostError || !repostData?.length) return own;

        const originalIds = [...new Set(repostData.map((row) => row.post_id))];
        const { data: originals, error: originalsError } = await withProfilePostColumns((columns) =>
          supabase.from('posts').select(columns).in('id', originalIds),
        );
        if (originalsError || !originals?.length) return own;

        const originalRows = originals as unknown as ProfilePostRow[];
        const authorIds = [...new Set(originalRows.map((post) => post.user_id))];
        const { data: authors } = await supabase
          .from('profiles_public')
          .select('user_id, display_name, avatar_url')
          .in('user_id', authorIds);
        const authorMap = new Map((authors ?? []).map((row) => [row.user_id, row]));
        const reposts: RepostRow[] = repostData.map((row) => ({
          ...row,
          profile: { display_name: author.display_name, avatar_url: author.avatar_url },
        }));

        return profileItemsWithReposts(
          own,
          reposts,
          originalRows.map((post) => profilePostFromRow(
            post,
            authorMap.get(post.user_id) || { display_name: null, avatar_url: null },
          )),
        );
      } catch (repostFailure) {
        console.error(repostFailure);
        return own;
      }
    },
    enabled: !!targetUserId,
    staleTime: 0,
  });

  const posts = data ?? EMPTY_POSTS;

  const createPost = useMutation({
    mutationFn: async ({ 
      content, 
      file,
      files,
      mediaType,
      location,
      altText,
      commentsEnabled = true,
      embed,
    }: { 
      content?: string; 
      file?: File;
      files?: File[];
      mediaType?: 'photo' | 'video' | 'text' | 'collage';
      location?: string;
      altText?: string;
      commentsEnabled?: boolean;
      embed?: EmbedDraft;
    }) => {
      if (!user) throw new Error('Must be logged in');

      if (embed) {
        const columns = embedColumnsForInsert(embed);
        const { error: insertError } = await supabase
          .from('posts')
          .insert({
            user_id: user.id,
            content: content || null,
            location: location || null,
            alt_text: altText || null,
            comments_enabled: commentsEnabled,
            ...columns,
          });
        if (insertError) throw insertError;
        return;
      }

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
      toast.error(embedColumnMissing(error)
        ? videoEmbedMigrationMessage()
        : errorMessage(error, 'Failed to share post'));
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

  const visiblePosts = postsForViewer(
    posts,
    user?.id,
    targetUserId,
    Boolean(targetUserId && isBlocked(targetUserId)),
  );

  return {
    posts: visiblePosts,
    isLoading,
    createPost,
    deletePost,
    refetch,
  };
}
