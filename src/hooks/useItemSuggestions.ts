import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ItemSuggestion {
  id: string;
  project_id: string;
  suggested_by: string;
  category: string;
  name: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'denied';
  reviewed_by: string | null;
  created_at: string;
  suggester_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useItemSuggestions(projectId?: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['item-suggestions', projectId],
    queryFn: async (): Promise<ItemSuggestion[]> => {
      if (!projectId) return [];
      const { data, error } = await (supabase.from('project_item_suggestions') as any)
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data || []).map((d: any) => d.suggested_by))] as string[];
      let profileMap = new Map();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);
        profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      }

      return (data || []).map((s: any) => ({
        ...s,
        suggester_profile: profileMap.get(s.suggested_by),
      }));
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`suggestions-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_item_suggestions',
        filter: `project_id=eq.${projectId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['item-suggestions', projectId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, queryClient]);

  return query;
}

export function useSuggestItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { project_id: string; category: string; name: string; notes?: string }) => {
      if (!user) throw new Error('Must be logged in');
      const { error } = await (supabase.from('project_item_suggestions') as any)
        .insert({ ...data, suggested_by: user.id });
      if (error) throw error;

      // Notify owner
      const { data: project } = await supabase.from('projects').select('creator_id, title').eq('id', data.project_id).single();
      if (project && project.creator_id !== user.id) {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', user.id).single();
        await supabase.from('notifications').insert({
          user_id: project.creator_id,
          type: 'project_update',
          title: 'Item Suggestion',
          body: `${profile?.display_name || 'A member'} suggested "${data.name}" for ${project.title}`,
          data: { project_id: data.project_id },
        });
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['item-suggestions', vars.project_id] });
      toast.success('Suggestion submitted');
    },
    onError: () => toast.error('Failed to submit suggestion'),
  });
}

export function useReviewSuggestion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ suggestionId, projectId, status, suggestion }: {
      suggestionId: string;
      projectId: string;
      status: 'approved' | 'denied';
      suggestion: ItemSuggestion;
    }) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await (supabase.from('project_item_suggestions') as any)
        .update({ status, reviewed_by: user.id })
        .eq('id', suggestionId);
      if (error) throw error;

      // If approved, create checklist item
      if (status === 'approved') {
        await (supabase.from('project_checklist_items') as any).insert({
          project_id: projectId,
          category: suggestion.category,
          name: suggestion.name,
          notes: suggestion.notes,
          created_by: user.id,
        });
      }

      // Notify suggester
      if (suggestion.suggested_by !== user.id) {
        await supabase.from('notifications').insert({
          user_id: suggestion.suggested_by,
          type: 'project_update',
          title: status === 'approved' ? 'Suggestion Approved' : 'Suggestion Denied',
          body: `Your suggestion "${suggestion.name}" was ${status}`,
          data: { project_id: projectId },
        });
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['item-suggestions', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-checklist', vars.projectId] });
      toast.success('Suggestion reviewed');
    },
    onError: () => toast.error('Failed to review suggestion'),
  });
}
