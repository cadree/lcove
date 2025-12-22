import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "./useAdmin";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface AdminUserData {
  user_id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  city: string | null;
  mindset_level: number | null;
  access_status: string | null;
  created_at: string | null;
  skills: string[];
  passions: string[];
  creative_roles: string[];
  credit_balance: number;
  is_admin: boolean;
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  message: string;
  target_audience: {
    type: "all" | "mindset_level" | "city";
    value?: string | number;
  };
  sent_by: string;
  sent_at: string;
  recipient_count: number;
}

// Helper: best-effort admin action logging (won't break primary action)
async function logAdminActionSafe(payload: {
  admin_id: string;
  action_type: string;
  target_user_id: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("admin_actions").insert([
    {
      admin_id: payload.admin_id,
      action_type: payload.action_type,
      target_user_id: payload.target_user_id,
      reason: payload.reason,
      metadata: (payload.metadata ?? null) as unknown as Json,
    },
  ]);

  if (error) {
    // IMPORTANT: do not throw — logging should never break core admin flows
    console.warn("Admin action log failed (non-blocking):", error);
  }
}

// Fetch announcement history
export function useAdminAnnouncements() {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ["admin-announcements"],
    enabled: isAdmin,
    queryFn: async (): Promise<AdminAnnouncement[]> => {
      const { data, error } = await supabase
        .from("admin_announcements")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        target_audience: item.target_audience as AdminAnnouncement["target_audience"],
        sent_by: item.sent_by,
        sent_at: item.sent_at,
        recipient_count: item.recipient_count,
      }));
    },
  });
}

// Send mass notification
export function useSendMassNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      message: string;
      targetAudience: { type: "all" | "mindset_level" | "city"; value?: string | number };
    }) => {
      const { data: result, error } = await supabase.functions.invoke("send-mass-notification", {
        body: data,
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["admin-actions"] });
      toast.success(`Notification sent to ${result?.recipientCount ?? 0} users`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to send notification: ${error.message}`);
    },
  });
}

// Adjust user credits
export function useAdjustUserCredits() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { userId: string; amount: number; reason: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data: currentCredits, error: creditsErr } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", data.userId)
        .single();

      if (creditsErr) throw creditsErr;

      const currentBalance = currentCredits?.balance || 0;
      const newBalance = currentBalance + data.amount;

      if (newBalance < 0) {
        throw new Error("Cannot deduct more credits than available");
      }

      // Ledger entry (array insert to satisfy Supabase TS overloads)
      const { error: ledgerError } = await supabase.from("credit_ledger").insert([
        {
          user_id: data.userId,
          amount: data.amount,
          balance_after: newBalance,
          type: data.amount > 0 ? "admin_award" : "admin_deduct",
          description: data.reason,
        },
      ]);

      if (ledgerError) throw ledgerError;

      await logAdminActionSafe({
        admin_id: user.id,
        action_type: data.amount > 0 ? "award_credits" : "deduct_credits",
        target_user_id: data.userId,
        reason: data.reason,
        metadata: { amount: data.amount, new_balance: newBalance },
      });

      return { newBalance };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-data"] });
      queryClient.invalidateQueries({ queryKey: ["admin-actions"] });
      toast.success("Credits adjusted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to adjust credits: ${error.message}`);
    },
  });
}
