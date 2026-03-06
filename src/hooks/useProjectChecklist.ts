import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ChecklistItem {
  id: string;
  project_id: string;
  category: 'props' | 'equipment' | 'other';
  name: string;
  assigned_user_id: string | null;
  status: 'unclaimed' | 'claimed' | 'completed';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assigned_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useProjectChecklist(projectId?: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['project-checklist', projectId],
    queryFn: async (): Promise<ChecklistItem[]> => {
      if (!projectId) return [];

      const { data, error } = await (supabase.from('project_checklist_items') as any)
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch assigned user profiles
      const assignedIds = [...new Set((data || []).filter((d: any) => d.assigned_user_id).map((d: any) => d.assigned_user_id))] as string[];
      let profileMap = new Map();
      if (assignedIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', assignedIds);
        profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      }

      return (data || []).map((item: any) => ({
        ...item,
        assigned_profile: item.assigned_user_id ? profileMap.get(item.assigned_user_id) : undefined,
      }));
    },
    enabled: !!projectId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`checklist-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_checklist_items',
        filter: `project_id=eq.${projectId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['project-checklist', projectId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, queryClient]);

  return query;
}

export function useCreateChecklistItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { project_id: string; category: string; name: string; notes?: string }) => {
      if (!user) throw new Error('Must be logged in');
      const { error } = await (supabase.from('project_checklist_items') as any)
        .insert({ ...data, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-checklist', vars.project_id] });
      toast.success('Item added to checklist');
    },
    onError: () => toast.error('Failed to add item'),
  });
}

export function useClaimChecklistItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ itemId, projectId }: { itemId: string; projectId: string }) => {
      if (!user) throw new Error('Must be logged in');
      const { error } = await (supabase.from('project_checklist_items') as any)
        .update({ assigned_user_id: user.id, status: 'claimed' })
        .eq('id', itemId)
        .eq('status', 'unclaimed');
      if (error) throw error;

      // Notify project owner
      const { data: project } = await supabase.from('projects').select('creator_id, title').eq('id', projectId).single();
      if (project && project.creator_id !== user.id) {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', user.id).single();
        await supabase.from('notifications').insert({
          user_id: project.creator_id,
          type: 'project_update',
          title: 'Checklist Item Claimed',
          body: `${profile?.display_name || 'A team member'} claimed an item in ${project.title}`,
          data: { project_id: projectId },
        });
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-checklist', vars.projectId] });
      toast.success('You claimed this item');
    },
    onError: () => toast.error('Failed to claim item'),
  });
}

export function useCompleteChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, projectId }: { itemId: string; projectId: string }) => {
      const { error } = await (supabase.from('project_checklist_items') as any)
        .update({ status: 'completed' })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-checklist', vars.projectId] });
      toast.success('Item completed');
    },
    onError: () => toast.error('Failed to complete item'),
  });
}

export function useDeleteChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, projectId }: { itemId: string; projectId: string }) => {
      const { error } = await (supabase.from('project_checklist_items') as any)
        .delete()
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-checklist', vars.projectId] });
      toast.success('Item removed');
    },
    onError: () => toast.error('Failed to remove item'),
  });
}
