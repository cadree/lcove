import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ChallengeSubmission {
  id: string;
  challenge_id: string;
  user_id: string;
  submission_url: string | null;
  submission_text: string | null;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
}

export function useMyParticipation(challengeId?: string) {
  return useQuery({
    queryKey: ['challenge-participation', challengeId],
    queryFn: async () => {
      if (!challengeId) return null;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from('challenge_participants')
        .select('*')
        .eq('challenge_id', challengeId)
        .eq('user_id', u.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!challengeId,
  });
}

export function useMySubmission(challengeId?: string) {
  return useQuery({
    queryKey: ['challenge-submission', 'mine', challengeId],
    queryFn: async () => {
      if (!challengeId) return null;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from('challenge_submissions')
        .select('*')
        .eq('challenge_id', challengeId)
        .eq('user_id', u.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as ChallengeSubmission | null;
    },
    enabled: !!challengeId,
  });
}

export function useChallengeSubmissions(challengeId?: string) {
  return useQuery({
    queryKey: ['challenge-submissions', challengeId],
    queryFn: async () => {
      if (!challengeId) return [];
      const { data, error } = await supabase
        .from('challenge_submissions')
        .select('*')
        .eq('challenge_id', challengeId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data as ChallengeSubmission[];
    },
    enabled: !!challengeId,
  });
}

export function useJoinChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Sign in to join');
      const { error } = await supabase
        .from('challenge_participants')
        .insert({ challenge_id: challengeId, user_id: u.user.id });
      if (error) throw error;
    },
    onSuccess: (_d, challengeId) => {
      qc.invalidateQueries({ queryKey: ['challenge-participation', challengeId] });
      qc.invalidateQueries({ queryKey: ['challenges', challengeId] });
      qc.invalidateQueries({ queryKey: ['challenges'] });
      toast.success('Joined! You can now submit your entry.');
    },
    onError: (e: any) => toast.error(e.message || 'Could not join'),
  });
}

export function useSubmitEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      submission_url,
      submission_text,
    }: { challengeId: string; submission_url?: string | null; submission_text?: string | null }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Sign in to submit');
      const { data, error } = await supabase
        .from('challenge_submissions')
        .insert({
          challenge_id: challengeId,
          user_id: u.user.id,
          submission_url: submission_url ?? null,
          submission_text: submission_text ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['challenge-submission', 'mine', vars.challengeId] });
      qc.invalidateQueries({ queryKey: ['challenge-submissions', vars.challengeId] });
      toast.success('Entry submitted! 🎉');
    },
    onError: (e: any) => toast.error(e.message || 'Submission failed'),
  });
}

export function useReviewSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' | 'rewarded' }) => {
      const { data, error } = await supabase
        .from('challenge_submissions')
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['challenge-submissions'] });
      toast.success('Updated');
    },
    onError: (e: any) => toast.error(e.message || 'Review failed'),
  });
}
