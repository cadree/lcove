import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isGrantEligible } from "@/lib/grantEligibility";
import { toast } from "sonner";

export interface MembershipStatus {
  subscribed: boolean;
  tier: "community" | "elite" | null;
  subscription_end: string | null;
  monthly_amount: number | null;
  lifetime_contribution: number;
  grant_eligible: boolean;
}

interface MembershipRow {
  tier: string;
  status: string;
  monthly_amount: number | null;
  lifetime_contribution: number | null;
  grant_eligible: boolean | null;
  current_period_end: string | null;
}

function membershipFromRow(row: MembershipRow | null): MembershipStatus | null {
  if (!row) return null;
  const tier = row.tier === "community" || row.tier === "elite" ? row.tier : null;
  const subscribed = !!tier && (row.status === "active" || row.status === "trialing");
  return {
    subscribed,
    tier: subscribed ? tier : null,
    subscription_end: row.current_period_end,
    monthly_amount: row.monthly_amount,
    lifetime_contribution: Number(row.lifetime_contribution || 0),
    grant_eligible: subscribed ? isGrantEligible(row.lifetime_contribution) : false,
  };
}

function membershipFromPayload(data: Partial<MembershipStatus> | null): MembershipStatus | null {
  if (!data) return null;
  const tier = data.tier === "community" || data.tier === "elite" ? data.tier : null;
  const subscribed = Boolean(data.subscribed) && !!tier;
  return {
    subscribed,
    tier: subscribed ? tier : null,
    subscription_end: data.subscription_end ?? null,
    monthly_amount: data.monthly_amount ?? null,
    lifetime_contribution: Number(data.lifetime_contribution || 0),
    grant_eligible: subscribed ? isGrantEligible(data.lifetime_contribution) : false,
  };
}

async function readOwnMembership(userId: string): Promise<MembershipStatus | null> {
  const { data, error } = await supabase
    .from("memberships")
    .select("tier, status, monthly_amount, lifetime_contribution, grant_eligible, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("Error reading membership row", error);
    return null;
  }
  return membershipFromRow(data);
}

export const useMembership = () => {
  const { user } = useAuth();
  const [membership, setMembership] = useState<MembershipStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const checkMembership = useCallback(async () => {
    if (!user) {
      setMembership(null);
      setIsLoading(false);
      return;
    }

    // The webhook writes memberships. RLS lets the owner read that row.
    // Show it immediately, then refresh from Stripe. A failed refresh must
    // not hide an active row.
    let row: MembershipStatus | null = null;
    try {
      row = await readOwnMembership(user.id);
      if (row) setMembership(membershipFromPayload(row));
    } catch (error) {
      console.error("Error reading membership row", error);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!row) setMembership(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke("check-membership", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error || !data || data.error) {
        if (!row) setMembership(null);
        if (error) console.error("Error checking membership:", error);
        return;
      }
      setMembership(membershipFromPayload(data));
    } catch (error) {
      console.error("Error checking membership:", error);
      if (!row) setMembership(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkMembership();
  }, [checkMembership]);

  // Auto-refresh every minute
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkMembership, 60000);
    return () => clearInterval(interval);
  }, [user, checkMembership]);

  const startCheckout = async (tier: "community" | "elite", customAmount?: number) => {
    if (Capacitor.getPlatform() === "ios") {
      toast.error("Membership checkout isn't available in the iOS app.");
      return;
    }

    if (!user) {
      toast.error("Please sign in to become a member");
      return;
    }

    setIsCheckingOut(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const { data, error } = await supabase.functions.invoke("create-membership-checkout", {
        body: { tier, customAmount },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        // Try window.open first, then location.href, then show manual link
        const win = window.open(data.url, "_blank");
        if (!win || win.closed) {
          try {
            window.location.href = data.url;
          } catch {
            toast.info("Click the link to complete checkout", {
              duration: 15000,
              action: {
                label: "Open Checkout",
                onClick: () => window.open(data.url, "_blank"),
              },
            });
          }
        }
      }
    } catch (error) {
      console.error("Error starting checkout:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const openCustomerPortal = async () => {
    if (Capacitor.getPlatform() === "ios") {
      toast.error("Subscription billing isn't available in the iOS app.");
      return;
    }

    if (!user) {
      toast.error("Please sign in first");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        const win = window.open(data.url, "_blank");
        if (!win || win.closed) {
          try {
            window.location.href = data.url;
          } catch {
            toast.info("Click the link to manage your subscription", {
              duration: 15000,
              action: {
                label: "Open Portal",
                onClick: () => window.open(data.url, "_blank"),
              },
            });
          }
        }
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast.error("Failed to open billing portal. Please try again.");
    }
  };

  return {
    membership,
    isLoading,
    isCheckingOut,
    checkMembership,
    startCheckout,
    openCustomerPortal,
  };
};
