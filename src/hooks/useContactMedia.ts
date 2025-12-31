import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ContactMedia {
  id: string;
  pipeline_item_id: string;
  owner_user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  notes: string | null;
  created_at: string;
}

export function useContactMedia(pipelineItemId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: media = [], isLoading } = useQuery({
    queryKey: ['contact-media', pipelineItemId],
    queryFn: async () => {
      if (!pipelineItemId) return [];
      const { data, error } = await supabase
        .from('contact_media')
        .select('*')
        .eq('pipeline_item_id', pipelineItemId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ContactMedia[];
    },
    enabled: !!user && !!pipelineItemId,
  });

  const uploadMedia = useMutation({
    mutationFn: async ({ file, mediaType, notes }: { file: File; mediaType: 'image' | 'video'; notes?: string }) => {
      if (!user || !pipelineItemId) throw new Error("Not authenticated");

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${pipelineItemId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('contact-media')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('contact-media')
        .getPublicUrl(fileName);

      // Insert record
      const { data, error } = await supabase
        .from('contact_media')
        .insert({
          pipeline_item_id: pipelineItemId,
          owner_user_id: user.id,
          media_url: urlData.publicUrl,
          media_type: mediaType,
          notes: notes || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-media', pipelineItemId] });
    },
  });

  const updateNotes = useMutation({
    mutationFn: async ({ mediaId, notes }: { mediaId: string; notes: string }) => {
      const { error } = await supabase
        .from('contact_media')
        .update({ notes })
        .eq('id', mediaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-media', pipelineItemId] });
    },
  });

  const deleteMedia = useMutation({
    mutationFn: async (mediaId: string) => {
      const { error } = await supabase
        .from('contact_media')
        .delete()
        .eq('id', mediaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-media', pipelineItemId] });
    },
  });

  return {
    media,
    isLoading,
    uploadMedia: uploadMedia.mutateAsync,
    updateNotes: updateNotes.mutateAsync,
    deleteMedia: deleteMedia.mutateAsync,
    isUploading: uploadMedia.isPending,
  };
}
