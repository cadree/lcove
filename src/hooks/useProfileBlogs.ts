import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface BlogPost {
  id: string;
  user_id: string;
  title: string;
  content: string;
  cover_image_url: string | null;
  excerpt: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useProfileBlogs(userId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const targetUserId = userId || user?.id;
  const isOwnProfile = targetUserId === user?.id;

  const { data: blogs = [], isLoading, refetch } = useQuery({
    queryKey: ['profile-blogs', targetUserId],
    queryFn: async (): Promise<BlogPost[]> => {
      if (!targetUserId) return [];

      // Build query based on whether viewing own profile
      let query = supabase
        .from('blog_posts')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      // If not own profile, only show published blogs
      if (!isOwnProfile) {
        query = query.eq('is_published', true);
      }

      const { data: blogsData, error } = await query;

      if (error) throw error;

      // Get profile for the user
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('user_id', targetUserId)
        .single();

      return (blogsData || []).map(blog => ({
        ...blog,
        profile: profile || { display_name: null, avatar_url: null },
      }));
    },
    enabled: !!targetUserId,
  });

  const createBlog = useMutation({
    mutationFn: async ({ 
      title, 
      content,
      coverImage,
      excerpt,
      isPublished = false,
    }: { 
      title: string;
      content: string;
      coverImage?: File;
      excerpt?: string;
      isPublished?: boolean;
    }) => {
      if (!user) throw new Error('Must be logged in');

      let coverImageUrl: string | null = null;

      if (coverImage) {
        const fileExt = coverImage.name.split('.').pop();
        const fileName = `${user.id}/blog-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, coverImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(fileName);

        coverImageUrl = publicUrl;
      }

      const { error: insertError } = await supabase
        .from('blog_posts')
        .insert({
          user_id: user.id,
          title,
          content,
          cover_image_url: coverImageUrl,
          excerpt: excerpt || content.slice(0, 150) + '...',
          is_published: isPublished,
          published_at: isPublished ? new Date().toISOString() : null,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-blogs', targetUserId] });
      toast.success('Blog saved!');
    },
    onError: (error) => {
      toast.error('Failed to save blog');
      console.error(error);
    },
  });

  const updateBlog = useMutation({
    mutationFn: async ({ 
      id,
      title, 
      content,
      excerpt,
      isPublished,
    }: { 
      id: string;
      title?: string;
      content?: string;
      excerpt?: string;
      isPublished?: boolean;
    }) => {
      if (!user) throw new Error('Must be logged in');

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (excerpt !== undefined) updates.excerpt = excerpt;
      if (isPublished !== undefined) {
        updates.is_published = isPublished;
        if (isPublished) updates.published_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('blog_posts')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-blogs', targetUserId] });
      toast.success('Blog updated!');
    },
    onError: () => {
      toast.error('Failed to update blog');
    },
  });

  const deleteBlog = useMutation({
    mutationFn: async (blogId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', blogId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-blogs', targetUserId] });
      toast.success('Blog deleted');
    },
    onError: () => {
      toast.error('Failed to delete blog');
    },
  });

  return {
    blogs,
    isLoading,
    createBlog,
    updateBlog,
    deleteBlog,
    refetch,
  };
}
