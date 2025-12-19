import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NetworkContent } from './useCinema';

// Fetch ALL network content for manage page (including drafts)
export const useNetworkContentManage = (networkId: string) => {
  return useQuery({
    queryKey: ['network-content-manage', networkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('network_content')
        .select('*')
        .eq('network_id', networkId)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as NetworkContent[];
    },
    enabled: !!networkId,
  });
};

// Update content
export const useUpdateContent = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      contentId, 
      updates 
    }: { 
      contentId: string; 
      updates: Partial<NetworkContent>;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('network_content')
        .update(updates)
        .eq('id', contentId)
        .eq('creator_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['network-content-manage', data.network_id] });
      queryClient.invalidateQueries({ queryKey: ['network-content', data.network_id] });
      queryClient.invalidateQueries({ queryKey: ['content', data.id] });
      toast.success('Content updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};

// Delete content
export const useDeleteContent = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contentId, networkId }: { contentId: string; networkId: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('network_content')
        .delete()
        .eq('id', contentId)
        .eq('creator_id', user.id);

      if (error) throw error;
      return { networkId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['network-content-manage', data.networkId] });
      queryClient.invalidateQueries({ queryKey: ['network-content', data.networkId] });
      toast.success('Content deleted successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};

// Toggle publish status
export const useTogglePublish = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      contentId, 
      isPublished 
    }: { 
      contentId: string; 
      isPublished: boolean;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('network_content')
        .update({ is_published: isPublished })
        .eq('id', contentId)
        .eq('creator_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['network-content-manage', data.network_id] });
      queryClient.invalidateQueries({ queryKey: ['network-content', data.network_id] });
      toast.success(data.is_published ? 'Content published!' : 'Content unpublished!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};
