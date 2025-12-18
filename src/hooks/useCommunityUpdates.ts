import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type UpdateCategory = 'announcement' | 'spotlight' | 'update' | 'transparency';

export interface CommunityUpdate {
  id: string;
  author_id: string;
  title: string;
  content: string;
  category: UpdateCategory;
  image_url: string | null;
  is_pinned: boolean;
  is_published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
  author?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useCommunityUpdates(category?: UpdateCategory) {
  return useQuery({
    queryKey: ['community-updates', category],
    queryFn: async () => {
      let query = supabase
        .from('community_updates')
        .select(`*`)
        .eq('is_published', true)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as CommunityUpdate[];
    },
  });
}

export function useCreateCommunityUpdate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      content: string;
      category: UpdateCategory;
      image_url?: string;
      is_pinned?: boolean;
    }) => {
      const { error } = await supabase
        .from('community_updates')
        .insert({
          ...data,
          author_id: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-updates'] });
      toast.success('Update published');
    },
    onError: () => {
      toast.error('Failed to publish update');
    },
  });
}

export function useUpdateCommunityUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string } & Partial<CommunityUpdate>) => {
      const { id, ...updateData } = data;
      const { error } = await supabase
        .from('community_updates')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-updates'] });
      toast.success('Update saved');
    },
  });
}

export function useDeleteCommunityUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('community_updates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-updates'] });
      toast.success('Update deleted');
    },
  });
}

export const UPDATE_CATEGORY_CONFIG = {
  announcement: { label: 'Announcement', icon: '📢', color: 'bg-blue-500' },
  spotlight: { label: 'Spotlight', icon: '⭐', color: 'bg-yellow-500' },
  update: { label: 'Update', icon: '📝', color: 'bg-green-500' },
  transparency: { label: 'Transparency', icon: '📊', color: 'bg-purple-500' },
} as const;
