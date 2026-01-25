import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface StudioBooking {
  id: string;
  item_id: string;
  requester_id: string;
  owner_id: string;
  requested_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_hours: number | null;
  total_price: number | null;
  credits_spent: number;
  payment_type: 'cash' | 'credits' | 'hybrid' | null;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  message: string | null;
  owner_notes: string | null;
  stripe_payment_intent_id: string | null;
  seller_amount: number | null;
  platform_fee: number | null;
  seller_payout_status: string | null;
  created_at: string;
  updated_at: string;
  item?: {
    title: string;
    images: string[];
    price: number;
    location: string | null;
  };
  requester?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface StudioReview {
  id: string;
  item_id: string;
  booking_id: string | null;
  reviewer_id: string;
  rating: number;
  review: string | null;
  created_at: string;
  reviewer?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export const useStudioBookings = (role: 'requester' | 'owner') => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['studio-bookings', role, user?.id],
    queryFn: async () => {
      if (!user) return [];

      const column = role === 'requester' ? 'requester_id' : 'owner_id';
      const { data, error } = await supabase
        .from('studio_bookings')
        .select(`
          *,
          item:store_items(title, images, price, location)
        `)
        .eq(column, user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StudioBooking[];
    },
    enabled: !!user,
  });
};

export const useItemBookings = (itemId: string | undefined) => {
  return useQuery({
    queryKey: ['item-bookings', itemId],
    queryFn: async () => {
      if (!itemId) return [];

      const { data, error } = await supabase
        .from('studio_bookings')
        .select('requested_date, status')
        .eq('item_id', itemId)
        .in('status', ['pending', 'approved']);

      if (error) throw error;
      return data;
    },
    enabled: !!itemId,
  });
};

export const useStudioReviews = (itemId: string | undefined) => {
  return useQuery({
    queryKey: ['studio-reviews', itemId],
    queryFn: async () => {
      if (!itemId) return [];

      const { data, error } = await supabase
        .from('studio_reviews')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StudioReview[];
    },
    enabled: !!itemId,
  });
};

export const useCreateBookingRequest = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      item_id: string;
      owner_id: string;
      requested_date: string;
      start_time?: string;
      end_time?: string;
      duration_hours?: number;
      total_price?: number;
      credits_spent?: number;
      payment_type?: 'cash' | 'credits' | 'hybrid';
      message?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data: booking, error } = await supabase
        .from('studio_bookings')
        .insert({
          ...data,
          requester_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-bookings'] });
      toast({ title: 'Booking request sent!' });
    },
    onError: (error) => {
      toast({ title: 'Failed to send request', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateBookingStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, status, owner_notes }: { 
      bookingId: string; 
      status: 'approved' | 'rejected' | 'completed' | 'cancelled';
      owner_notes?: string;
    }) => {
      const { error } = await supabase
        .from('studio_bookings')
        .update({ status, owner_notes })
        .eq('id', bookingId);

      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['studio-bookings'] });
      toast({ title: `Booking ${status}` });
    },
  });
};

export const usePurchaseStudioBooking = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, paymentType }: { 
      bookingId: string; 
      paymentType: 'cash' | 'credits';
    }) => {
      const { data, error } = await supabase.functions.invoke('purchase-studio-booking', {
        body: { bookingId, paymentType },
      });

      if (error) throw new Error(error.message);
      return data as { success?: boolean; url?: string; bookingId: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['studio-bookings'] });
      
      if (data.url) {
        // Redirect to Stripe checkout
        window.open(data.url, '_blank');
      } else if (data.success) {
        toast({ title: 'Booking payment complete!' });
      }
    },
    onError: (error) => {
      toast({ 
        title: 'Payment failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
};

export const useSubmitReview = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      item_id: string;
      booking_id: string;
      rating: number;
      review?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('studio_reviews')
        .insert({
          ...data,
          reviewer_id: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-reviews'] });
      toast({ title: 'Review submitted!' });
    },
    onError: (error) => {
      toast({ title: 'Failed to submit review', description: error.message, variant: 'destructive' });
    },
  });
};
