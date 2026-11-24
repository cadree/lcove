import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCreateMusicPayoutAccount, useRefreshMusicPayoutStatus } from "@/hooks/useMusicPayouts";

interface VerifyResultRow {
  status?: string;
  updated?: boolean;
}

export interface MusicInvokePayload {
  results?: VerifyResultRow[];
  error?: string;
  url?: string;
}

export function asInvokePayload(value: unknown): MusicInvokePayload | null {
  if (typeof value !== "object" || value === null) return null;
  return value as MusicInvokePayload;
}

/**
 * Stripe checkout and payout onboarding return to /profile/:id with a query
 * param. Whatever page reads it (the profile's music preview or the Music page)
 * confirms with the server before saying anything is unlocked.
 */
export function useMusicCheckoutReturn(isOwner: boolean) {
  const queryClient = useQueryClient();
  const refreshPayoutStatus = useRefreshMusicPayoutStatus();
  const refreshPayoutsRef = useRef(refreshPayoutStatus.mutate);
  refreshPayoutsRef.current = refreshPayoutStatus.mutate;
  const createPayout = useCreateMusicPayoutAccount();
  const createPayoutRef = useRef(createPayout.mutate);
  createPayoutRef.current = createPayout.mutate;

  // Refresh queries after returning from Stripe.
  // CRITICAL: never trust URL params alone to grant access. We MUST call the
  // verify edge function (which asks Stripe directly) before claiming success.
  // Canceled / abandoned checkouts must leave the track locked.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get("purchase");
    const subscribed = params.get("subscribed");
    const musicPayouts = params.get("music_payouts");

    if (purchase === "success") {
      // Optimistic toast removed — only confirm after Stripe verification.
      (async () => {
        try {
          const { data } = await supabase.functions.invoke("verify-music-purchase");
          // "paid" either just now (updated) or already by the webhook.
          const verified = asInvokePayload(data)?.results?.some((r) => r.status === "paid");
          if (verified) {
            toast.success("Payment confirmed — track unlocked!");
          } else {
            toast.info("Finalizing your purchase…", {
              description: "If this takes more than a minute, refresh the page.",
            });
          }
        } catch (e) {
          console.warn("[MusicPurchase] verify failed", e);
          toast.error("Could not verify payment. Please refresh in a moment.");
        }
        queryClient.invalidateQueries({ queryKey: ["exclusive-purchases"] });
        queryClient.invalidateQueries({ queryKey: ["my-exclusive-purchases"] });
        queryClient.invalidateQueries({ queryKey: ["artist-subscriptions"] });
        queryClient.invalidateQueries({ queryKey: ["private-track-url"] });
      })();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (purchase === "canceled") {
      // Defensive: ensure no client-side optimistic unlock happened.
      toast.info("Purchase canceled — track remains locked.");
      queryClient.invalidateQueries({ queryKey: ["my-exclusive-purchases"] });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (subscribed === "true") {
      (async () => {
        try {
          const { data } = await supabase.functions.invoke("verify-artist-subscription");
          const verified = asInvokePayload(data)?.results?.some(
            (r) => r.status === "active" && r.updated
          );
          if (verified) {
            toast.success("Subscription active! You now have access.");
          } else {
            toast.info("Finalizing your subscription…");
          }
        } catch (e) {
          console.warn("[MusicSub] verify failed", e);
          toast.error("Could not verify subscription. Please refresh in a moment.");
        }
        queryClient.invalidateQueries({ queryKey: ["artist-subscriptions"] });
        queryClient.invalidateQueries({ queryKey: ["exclusive-purchases"] });
      })();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (musicPayouts === "success" && isOwner) {
      window.history.replaceState({}, "", window.location.pathname);
      refreshPayoutsRef.current(undefined, { onSuccess: (status) => {
        if (status.payout_enabled) toast.success("Payouts connected!");
        else toast.info("Setup saved. Stripe may still need details or verification before payouts are ready.");
      } });
    } else if (musicPayouts === "refresh" && isOwner) {
      // Stripe account links are single-use. An expired link must create a fresh
      // one, not leave the artist at a dead end on their profile.
      window.history.replaceState({}, "", window.location.pathname);
      createPayoutRef.current();
    }
  }, [queryClient, isOwner]);
}
