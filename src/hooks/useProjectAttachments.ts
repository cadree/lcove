import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ProjectAttachment {
  id: string;
  project_id: string;
  uploaded_by: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  created_at: string;
}

export function useProjectAttachments(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['project-attachments', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await (supabase
        .from('project_attachments') as any)
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ProjectAttachment[];
    },
    enabled: !!projectId,
  });

  const uploadAttachment = useMutation({
    mutationFn: async ({ projectId, file }: { projectId: string; file: File }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${user.id}/project-attachments/${projectId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      // Determine file type
      let fileType = 'doc';
      if (file.type.startsWith('image/')) fileType = 'image';
      else if (file.type === 'application/pdf') fileType = 'pdf';
      else if (file.type.startsWith('video/')) fileType = 'video';
      else if (file.type.includes('zip') || file.type.includes('compressed')) fileType = 'zip';

      const { data, error } = await (supabase
        .from('project_attachments') as any)
        .insert({
          project_id: projectId,
          uploaded_by: user.id,
          file_url: publicUrl,
          file_name: file.name,
          file_type: fileType,
          file_size: file.size,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-attachments', variables.projectId] });
      toast({ title: 'File uploaded' });
    },
    onError: (error) => {
      toast({ title: 'Upload failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    },
  });

  const addLinkAttachment = useMutation({
    mutationFn: async ({ projectId, url, name }: { projectId: string; url: string; name: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await (supabase
        .from('project_attachments') as any)
        .insert({
          project_id: projectId,
          uploaded_by: user.id,
          file_url: url,
          file_name: name,
          file_type: 'link',
          file_size: null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-attachments', variables.projectId] });
      toast({ title: 'Link added' });
    },
    onError: (error) => {
      toast({ title: 'Failed to add link', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: async ({ attachmentId, projectId }: { attachmentId: string; projectId: string }) => {
      const { error } = await (supabase
        .from('project_attachments') as any)
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-attachments', variables.projectId] });
      toast({ title: 'Attachment removed' });
    },
  });

  return {
    attachments,
    isLoading,
    uploadAttachment: uploadAttachment.mutate,
    addLinkAttachment: addLinkAttachment.mutate,
    deleteAttachment: deleteAttachment.mutate,
    isUploading: uploadAttachment.isPending,
  };
}
