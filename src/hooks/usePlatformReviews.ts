import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PlatformReview {
  id: string;
  user_id: string;
  rating: number;
  content: string;
  is_approved: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
    city: string | null;
  } | null;
}

// Fetch approved platform reviews for the landing page
export function usePlatformReviews() {
  return useQuery({
    queryKey: ['platform-reviews'],
    queryFn: async () => {
      // First, fetch the reviews
      const { data: reviews, error } = await supabase
        .from('platform_reviews')
        .select('*')
        .eq('is_approved', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!reviews || reviews.length === 0) return [];

      // Get unique user IDs
      const userIds = [...new Set(reviews.map(r => r.user_id))];

      // Fetch profiles for these users using profiles_public view
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, display_name, avatar_url, city')
        .in('id', userIds);

      // Map profiles to reviews
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return reviews.map(review => ({
        ...review,
        profiles: profileMap.get(review.user_id) || null,
      })) as PlatformReview[];
    },
  });
}

// Fetch the current user's review if they have one
export function useMyPlatformReview() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-platform-review', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_reviews')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as PlatformReview | null;
    },
    enabled: !!user,
  });
}

// Create a new platform review
export function useCreatePlatformReview() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { rating: number; content: string }) => {
      const { error } = await supabase
        .from('platform_reviews')
        .insert({
          user_id: user!.id,
          rating: data.rating,
          content: data.content,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['my-platform-review'] });
      toast.success('Review submitted! It will appear after approval.');
    },
    onError: () => {
      toast.error('Failed to submit review');
    },
  });
}

// Update an existing platform review
export function useUpdatePlatformReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; rating: number; content: string }) => {
      const { error } = await supabase
        .from('platform_reviews')
        .update({
          rating: data.rating,
          content: data.content,
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['my-platform-review'] });
      toast.success('Review updated!');
    },
    onError: () => {
      toast.error('Failed to update review');
    },
  });
}

// Delete a platform review
export function useDeletePlatformReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('platform_reviews')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['my-platform-review'] });
      toast.success('Review deleted');
    },
    onError: () => {
      toast.error('Failed to delete review');
    },
  });
}
