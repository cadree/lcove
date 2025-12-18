import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface CreatorVerification {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  verification_type: 'standard' | 'premium' | 'partner';
  badge_label: string | null;
  applied_at: string;
  reviewed_at: string | null;
  portfolio_urls: string[] | null;
  social_links: Record<string, string> | null;
}

export function useCreatorVerification(userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ['creator-verification', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;

      const { data, error } = await supabase
        .from('creator_verifications')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (error) throw error;
      return data as CreatorVerification | null;
    },
    enabled: !!targetUserId,
  });
}

export function useApplyForVerification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      verification_type: 'standard' | 'premium' | 'partner';
      portfolio_urls?: string[];
      social_links?: Record<string, string>;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data: result, error } = await supabase
        .from('creator_verifications')
        .insert({
          user_id: user.id,
          verification_type: data.verification_type,
          portfolio_urls: data.portfolio_urls || [],
          social_links: data.social_links || {},
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-verification'] });
      toast({
        title: 'Application submitted',
        description: 'Your verification application is under review.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit application',
        variant: 'destructive',
      });
    },
  });
}

export function useVerificationBadge(userId?: string) {
  const { data: verification } = useCreatorVerification(userId);

  if (!verification || verification.status !== 'approved') {
    return null;
  }

  return {
    type: verification.verification_type,
    label: verification.badge_label || 'Verified Creator',
  };
}
