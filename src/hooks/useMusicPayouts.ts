import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MusicPayoutStatus {
  has_account: boolean;
  payout_enabled: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
}

/**
 * Reads payout state for a given artist (or current user if omitted).
 * Used to show "Connect payouts" banner on owner view, and to disable
 * Buy/Subscribe CTAs on visitor view when artist hasn't onboarded.
 */
export const useArtistPayoutStatus = (artistUserId?: string) => {
  return useQuery({
    queryKey: ["artist-payout-status", artistUserId],
    queryFn: async () => {
      if (!artistUserId) return { has_account: false, payout_enabled: false };
      // Use SECURITY DEFINER RPC so visitors (non-owners) can read another artist's payout state
      const { data, error } = await supabase.rpc("get_artist_payout_status", {
        artist_user_id: artistUserId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        has_account: !!row?.has_connect_account,
        payout_enabled: !!row?.payout_enabled,
      } as MusicPayoutStatus;
    },
    enabled: !!artistUserId,
  });
};

/** Live status check (calls Stripe to refresh the cached payout_enabled column). */
export const useRefreshMusicPayoutStatus = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-music-payout-status");
      if (error) throw error;
      return data as MusicPayoutStatus;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["artist-payout-status", user?.id] });
    },
  });
};

/** Begin Stripe Express onboarding for the current user (artist). */
export const useCreateMusicPayoutAccount = () => {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-music-payout-account");
      if (error) throw error;
      if (!data?.url) throw new Error("No onboarding URL returned");
      return data as { url: string; accountId: string };
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err: any) => {
      console.error("[MusicPayouts] onboarding error", err);
      toast.error(err?.message || "Failed to start payout setup");
    },
  });
};
