import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface StoreConnectStatus {
  hasAccount: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  requirements?: {
    currently_due?: string[];
    eventually_due?: string[];
    past_due?: string[];
  };
}

export const useStoreConnectStatus = (storeId: string | undefined) => {
  return useQuery({
    queryKey: ['store-connect-status', storeId],
    queryFn: async (): Promise<StoreConnectStatus> => {
      if (!storeId) {
        return { hasAccount: false };
      }

      const { data, error } = await supabase.functions.invoke('check-store-connect-status', {
        body: { storeId },
      });

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!storeId,
    staleTime: 1000 * 60, // Cache for 1 minute
  });
};

export const useCreateStoreConnectAccount = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storeId: string) => {
      const { data, error } = await supabase.functions.invoke('create-store-connect-account', {
        body: { storeId },
      });

      if (error) throw new Error(error.message);
      return data as { url: string; accountId: string };
    },
    onSuccess: (data, storeId) => {
      queryClient.invalidateQueries({ queryKey: ['store-connect-status', storeId] });
      // Redirect to Stripe onboarding
      if (data.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error) => {
      toast({
        title: 'Failed to set up payouts',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useStoreEarnings = (storeId: string | undefined) => {
  return useQuery({
    queryKey: ['store-earnings', storeId],
    queryFn: async () => {
      if (!storeId) return null;

      // Get orders for this store
      const { data: orders, error } = await supabase
        .from('store_orders')
        .select('total_price, credits_spent, seller_amount, platform_fee, status, created_at')
        .eq('store_id', storeId)
        .in('status', ['confirmed', 'completed']);

      if (error) throw error;

      // Calculate totals
      const totalGross = orders?.reduce((sum, o) => sum + (o.total_price || 0) + (o.credits_spent || 0), 0) || 0;
      const totalSellerAmount = orders?.reduce((sum, o) => sum + (o.seller_amount || 0), 0) || 0;
      const totalPlatformFee = orders?.reduce((sum, o) => sum + (o.platform_fee || 0), 0) || 0;
      const totalCashSales = orders?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;
      const totalCreditSales = orders?.reduce((sum, o) => sum + (o.credits_spent || 0), 0) || 0;

      return {
        totalGross,
        totalSellerAmount,
        totalPlatformFee,
        totalCashSales,
        totalCreditSales,
        orderCount: orders?.length || 0,
      };
    },
    enabled: !!storeId,
  });
};
