import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PortfolioFolder {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  display_order: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  post_count?: number;
}

export interface CreateFolderInput {
  name: string;
  description?: string;
  cover_image_url?: string;
  is_featured?: boolean;
}

export function usePortfolioFolders(userId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const targetUserId = userId || user?.id;

  const foldersQuery = useQuery({
    queryKey: ['portfolio-folders', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];

      const { data: folders, error } = await supabase
        .from('portfolio_folders')
        .select('*')
        .eq('user_id', targetUserId)
        .order('display_order', { ascending: true });

      if (error) throw error;

      // Get post counts for each folder
      const folderIds = folders.map(f => f.id);
      if (folderIds.length > 0) {
        const { data: posts } = await supabase
          .from('posts')
          .select('folder_id')
          .in('folder_id', folderIds);

        const counts: Record<string, number> = {};
        posts?.forEach(p => {
          if (p.folder_id) {
            counts[p.folder_id] = (counts[p.folder_id] || 0) + 1;
          }
        });

        return folders.map(f => ({
          ...f,
          post_count: counts[f.id] || 0
        })) as PortfolioFolder[];
      }

      return folders.map(f => ({ ...f, post_count: 0 })) as PortfolioFolder[];
    },
    enabled: !!targetUserId,
  });

  const createFolder = useMutation({
    mutationFn: async (input: CreateFolderInput) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('portfolio_folders')
        .insert({
          user_id: user.id,
          name: input.name,
          description: input.description || null,
          cover_image_url: input.cover_image_url || null,
          is_featured: input.is_featured || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-folders', user?.id] });
      toast.success('Folder created!');
    },
    onError: (error) => {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
    },
  });

  const updateFolder = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PortfolioFolder> & { id: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('portfolio_folders')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-folders', user?.id] });
      toast.success('Folder updated!');
    },
    onError: (error) => {
      console.error('Error updating folder:', error);
      toast.error('Failed to update folder');
    },
  });

  const deleteFolder = useMutation({
    mutationFn: async (folderId: string) => {
      if (!user) throw new Error('Not authenticated');

      // First, unassign posts from this folder
      await supabase
        .from('posts')
        .update({ folder_id: null })
        .eq('folder_id', folderId);

      const { error } = await supabase
        .from('portfolio_folders')
        .delete()
        .eq('id', folderId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-folders', user?.id] });
      toast.success('Folder deleted!');
    },
    onError: (error) => {
      console.error('Error deleting folder:', error);
      toast.error('Failed to delete folder');
    },
  });

  const assignPostToFolder = useMutation({
    mutationFn: async ({ postId, folderId }: { postId: string; folderId: string | null }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('posts')
        .update({ folder_id: folderId })
        .eq('id', postId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-folders', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
      toast.success('Post moved!');
    },
    onError: (error) => {
      console.error('Error moving post:', error);
      toast.error('Failed to move post');
    },
  });

  return {
    folders: foldersQuery.data || [],
    isLoading: foldersQuery.isLoading,
    createFolder,
    updateFolder,
    deleteFolder,
    assignPostToFolder,
  };
}

export function useFolderPosts(folderId: string | null, userId?: string) {
  return useQuery({
    queryKey: ['folder-posts', folderId, userId],
    queryFn: async () => {
      if (!folderId || !userId) return [];

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('folder_id', folderId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!folderId && !!userId,
  });
}
