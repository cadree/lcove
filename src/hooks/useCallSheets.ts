import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface RoleEntry {
  role_name: string;
  call_time: string;
  location: string;
  wrap_time: string;
  notes: string;
}

export interface CallSheet {
  id: string;
  project_id: string;
  shoot_date: string;
  general_location: string | null;
  general_notes: string | null;
  role_entries: RoleEntry[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useCallSheets(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: callSheets = [], isLoading } = useQuery({
    queryKey: ['call-sheets', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_call_sheets')
        .select('*')
        .eq('project_id', projectId)
        .order('shoot_date', { ascending: true });
      if (error) throw error;
      return (data || []).map((d) => ({
        ...d,
        role_entries: Array.isArray(d.role_entries) ? d.role_entries as unknown as RoleEntry[] : [],
      }));
    },
    enabled: !!projectId,
  });

  const createCallSheet = useMutation({
    mutationFn: async (input: {
      project_id: string;
      shoot_date: string;
      general_location?: string;
      general_notes?: string;
      role_entries: RoleEntry[];
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('project_call_sheets')
        .insert({
          project_id: input.project_id,
          shoot_date: input.shoot_date,
          general_location: input.general_location,
          general_notes: input.general_notes,
          role_entries: input.role_entries as unknown as Json,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-sheets', projectId] });
      toast.success('Call sheet created');
    },
    onError: () => toast.error('Failed to create call sheet'),
  });

  const updateCallSheet = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CallSheet> & { id: string }) => {
      const { role_entries, ...rest } = updates;
      const { error } = await supabase
        .from('project_call_sheets')
        .update({
          ...rest,
          ...(role_entries !== undefined ? { role_entries: role_entries as unknown as Json } : {}),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-sheets', projectId] });
      toast.success('Call sheet updated');
    },
    onError: () => toast.error('Failed to update call sheet'),
  });

  const deleteCallSheet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_call_sheets')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-sheets', projectId] });
      toast.success('Call sheet deleted');
    },
    onError: () => toast.error('Failed to delete call sheet'),
  });

  return {
    callSheets,
    isLoading,
    createCallSheet,
    updateCallSheet,
    deleteCallSheet,
  };
}
