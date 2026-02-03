import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ConnectStatus {
  connected: boolean;
  accountId: string | null;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  pendingBalance: number;
  availableBalance: number;
}

export function useEventConnectStatus() {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['event-connect-status', user?.id],
    queryFn: async (): Promise<ConnectStatus> => {
      const { data, error } = await supabase.functions.invoke('check-event-connect-status');
      
      if (error) {
        console.error('Error checking connect status:', error);
        throw error;
      }
      
      return data as ConnectStatus;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
    refetchOnWindowFocus: true,
  });

  return {
    status: data,
    isLoading,
    error,
    refetch,
    isConnected: data?.connected ?? false,
    isFullyOnboarded: data?.payoutsEnabled && data?.chargesEnabled,
    pendingBalance: data?.pendingBalance ?? 0,
    availableBalance: data?.availableBalance ?? 0,
  };
}

export function useCreateEventConnectAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('create-event-connect-account');
      
      if (error) throw error;
      
      return data as { url: string; accountId: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-connect-status'] });
    },
  });
}
