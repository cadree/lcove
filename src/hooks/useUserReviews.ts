import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UserReview {
  id: string;
  reviewer_id: string;
  reviewed_user_id: string;
  project_id: string | null;
  rating: number;
  title: string | null;
  content: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  reviewer?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  project?: {
    title: string;
  };
}

export function useUserReviews(userId?: string) {
  return useQuery({
    queryKey: ['user-reviews', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_reviews')
        .select(`*`)
        .eq('reviewed_user_id', userId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as UserReview[];
    },
    enabled: !!userId,
  });
}

export function useReviewStats(userId?: string) {
  const { data: reviews } = useUserReviews(userId);

  if (!reviews || reviews.length === 0) {
    return { averageRating: 0, totalReviews: 0, ratingDistribution: {} };
  }

  const totalReviews = reviews.length;
  const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
  
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach(r => {
    ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
  });

  return { averageRating, totalReviews, ratingDistribution };
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      reviewed_user_id: string;
      rating: number;
      title?: string;
      content?: string;
      project_id?: string;
    }) => {
      const { error } = await supabase
        .from('user_reviews')
        .insert({
          ...data,
          reviewer_id: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-reviews', variables.reviewed_user_id] });
      queryClient.invalidateQueries({ queryKey: ['reputation', variables.reviewed_user_id] });
      toast.success('Review submitted');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('You have already reviewed this user for this project');
      } else {
        toast.error('Failed to submit review');
      }
    },
  });
}

export function useUpdateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      rating?: number;
      title?: string;
      content?: string;
      reviewed_user_id: string;
    }) => {
      const { id, reviewed_user_id, ...updateData } = data;
      const { error } = await supabase
        .from('user_reviews')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-reviews', variables.reviewed_user_id] });
      toast.success('Review updated');
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; reviewed_user_id: string }) => {
      const { error } = await supabase
        .from('user_reviews')
        .delete()
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-reviews', variables.reviewed_user_id] });
      toast.success('Review deleted');
    },
  });
}

export function useCanReview(reviewedUserId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['can-review', user?.id, reviewedUserId],
    queryFn: async () => {
      if (!user || !reviewedUserId || user.id === reviewedUserId) {
        return false;
      }

      // Check if they've collaborated on a project
      const { data } = await supabase
        .from('project_applications')
        .select('project_id')
        .eq('applicant_id', reviewedUserId)
        .eq('status', 'accepted')
        .limit(1);

      return (data && data.length > 0) || true; // Allow reviews even without project collaboration
    },
    enabled: !!user && !!reviewedUserId,
  });
}
