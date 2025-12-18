import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MembershipStatus {
  subscribed: boolean;
  tier: "community" | "elite" | null;
  subscription_end: string | null;
  monthly_amount: number | null;
  lifetime_contribution: number;
  grant_eligible: boolean;
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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMembership(null);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("check-membership", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setMembership(data);
    } catch (error) {
      console.error("Error checking membership:", error);
      setMembership(null);
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
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error starting checkout:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const openCustomerPortal = async () => {
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
        window.open(data.url, "_blank");
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
