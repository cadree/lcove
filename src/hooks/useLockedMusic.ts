import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/lib/errorMessage";
import { readFunctionError } from "@/lib/functionError";
import {
  useAccessRules,
  useExclusiveTracks,
  useTrackSales,
  type ExclusiveAccessRule,
  type ExclusiveTrack,
} from "@/hooks/useExclusiveMusic";
import { useArtistPayoutStatus } from "@/hooks/useMusicPayouts";
import { asInvokePayload } from "@/hooks/useMusicCheckoutReturn";

/**
 * Everything a locked track card needs, shared by the catalog and the owner's
 * locked-music tools. Checkout is unchanged: the same edge functions, the same
 * price rules, and access still comes only from the server.
 */
export function useLockedMusic(userId: string | undefined) {
  const { user } = useAuth();
  const exclusive = useExclusiveTracks(userId);
  const access = useAccessRules(userId);
  const { data: payoutStatus } = useArtistPayoutStatus(userId);
  const { data: sales = {} } = useTrackSales(userId, !!user && user.id === userId);

  const handlePurchase = async (track: ExclusiveTrack, rule: ExclusiveAccessRule | null) => {
    if (Capacitor.getPlatform() === "ios") {
      toast.error("This purchase isn't available in the iOS app.");
      return;
    }
    if (!user) {
      toast.error("Sign in to purchase music");
      return;
    }

    const fnName =
      rule?.rule_type === "subscription" ? "create-artist-subscription" : "purchase-exclusive-track";
    const body =
      rule?.rule_type === "subscription"
        ? { artist_user_id: track.artist_user_id, access_rule_id: rule.id }
        : { track_id: track.id, access_rule_id: rule?.id ?? null, artist_user_id: track.artist_user_id };

    try {
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      const payload = asInvokePayload(data);
      if (error) {
        const serverMsg = await readFunctionError(error, data, "Failed to start checkout");
        console.error("[MusicPurchase] error", serverMsg);
        toast.error(serverMsg, { duration: 6000 });
        return;
      }
      if (payload?.error) {
        toast.error(payload.error, { duration: 6000 });
        return;
      }
      if (payload?.url) {
        // Same tab: a window.open after an await is blocked as a popup on iOS
        // Safari and most phone browsers. Checkout returns to this profile.
        window.location.assign(payload.url);
      } else {
        toast.error("No checkout URL returned");
      }
    } catch (err: unknown) {
      console.error("[MusicPurchase] exception", err);
      toast.error(errorMessage(err, "Failed to start checkout"), { duration: 6000 });
    }
  };

  return {
    ...exclusive,
    ...access,
    payoutStatus,
    payoutEnabled: !!payoutStatus?.payout_enabled,
    sales,
    handlePurchase,
  };
}

export type LockedMusic = ReturnType<typeof useLockedMusic>;
