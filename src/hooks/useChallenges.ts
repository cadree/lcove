import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Challenge {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  rules: string | null;
  reward_credits: number;
  cost_credits: number;
  deadline: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  is_published: boolean;
  participant_count: number;
  created_at: string;
  updated_at: string;
}

export function useChallenges() {
  return useQuery({
    queryKey: ['challenges', 'feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_published', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Challenge[];
    },
  });
}

export function useChallengesByCreator(creatorId?: string, includeUnpublished = false) {
  return useQuery({
    queryKey: ['challenges', 'creator', creatorId, includeUnpublished],
    queryFn: async () => {
      if (!creatorId) return [];
      let q = supabase.from('challenges').select('*').eq('creator_id', creatorId).order('created_at', { ascending: false });
      if (!includeUnpublished) q = q.eq('is_published', true).eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return data as Challenge[];
    },
    enabled: !!creatorId,
  });
}

export function useChallenge(id?: string) {
  return useQuery({
    queryKey: ['challenges', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('challenges').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as Challenge | null;
    },
    enabled: !!id,
  });
}

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Challenge>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('challenges')
        .insert({
          creator_id: u.user.id,
          title: input.title!,
          description: input.description ?? null,
          rules: input.rules ?? null,
          reward_credits: input.reward_credits ?? 0,
          cost_credits: input.cost_credits ?? 0,
          deadline: input.deadline ?? null,
          cover_image_url: input.cover_image_url ?? null,
          is_published: input.is_published ?? true,
          is_active: input.is_active ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Challenge;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['challenges'] });
      toast.success('Challenge created');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create challenge'),
  });
}

export function useUpdateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Challenge> & { id: string }) => {
      const { data, error } = await supabase.from('challenges').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data as Challenge;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challenges'] }),
    onError: (e: any) => toast.error(e.message || 'Update failed'),
  });
}

export function useDeleteChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('challenges').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['challenges'] });
      toast.success('Challenge deleted');
    },
  });
}
