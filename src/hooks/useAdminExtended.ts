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
    console.warn("Admin action log failed (non-blocking):", error);
  }
}

// Fetch admin user data with extended info
export function useAdminUserData() {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ["admin-user-data"],
    enabled: isAdmin,
    queryFn: async (): Promise<AdminUserData[]> => {
      const { data: userData, error: userError } = await supabase.rpc("get_admin_user_data");
      if (userError) throw userError;

      const { data: skills } = await supabase.from("user_skills").select("user_id, skills(name)");
      const { data: passions } = await supabase.from("user_passions").select("user_id, passions(name)");
      const { data: roles } = await supabase.from("user_creative_roles").select("user_id, creative_roles(name)");
      const { data: credits } = await supabase.from("user_credits").select("user_id, balance");
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id, role");

      const skillsMap = new Map<string, string[]>();
      const passionsMap = new Map<string, string[]>();
      const rolesMap = new Map<string, string[]>();
      const creditsMap = new Map<string, number>();
      const adminMap = new Map<string, boolean>();

      skills?.forEach((s: any) => {
        const arr = skillsMap.get(s.user_id) || [];
        if (s.skills?.name) arr.push(s.skills.name);
        skillsMap.set(s.user_id, arr);
      });

      passions?.forEach((p: any) => {
        const arr = passionsMap.get(p.user_id) || [];
        if (p.passions?.name) arr.push(p.passions.name);
        passionsMap.set(p.user_id, arr);
      });

      roles?.forEach((r: any) => {
        const arr = rolesMap.get(r.user_id) || [];
        if (r.creative_roles?.name) arr.push(r.creative_roles.name);
        rolesMap.set(r.user_id, arr);
      });

      credits?.forEach((c: any) => {
        creditsMap.set(c.user_id, c.balance || 0);
      });

      adminRoles?.forEach((ar: any) => {
        if (ar.role === "admin") adminMap.set(ar.user_id, true);
      });

      return (userData || []).map((u: any) => ({
        user_id: u.user_id,
        email: u.email || "",
        display_name: u.display_name,
        phone: u.phone,
        city: u.city,
        mindset_level: u.mindset_level,
        access_status: u.access_status,
        created_at: u.created_at,
        skills: skillsMap.get(u.user_id) || [],
        passions: passionsMap.get(u.user_id) || [],
        creative_roles: rolesMap.get(u.user_id) || [],
        credit_balance: creditsMap.get(u.user_id) || 0,
        is_admin: adminMap.get(u.user_id) || false,
      }));
    },
  });
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

      if (creditsErr && creditsErr.code !== "PGRST116") throw creditsErr;

      const currentBalance = currentCredits?.balance || 0;
      const newBalance = currentBalance + data.amount;

      if (newBalance < 0) {
        throw new Error("Cannot deduct more credits than available");
      }

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

// Bulk award credits
export function useBulkAwardCredits() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { userIds: string[]; amount: number; reason: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const results = await Promise.allSettled(
        data.userIds.map(async (userId) => {
          const { data: currentCredits } = await supabase
            .from("user_credits")
            .select("balance")
            .eq("user_id", userId)
            .single();

          const currentBalance = currentCredits?.balance || 0;
          const newBalance = currentBalance + data.amount;

          await supabase.from("credit_ledger").insert([
            {
              user_id: userId,
              amount: data.amount,
              balance_after: newBalance,
              type: "admin_award",
              description: data.reason,
            },
          ]);

          return userId;
        })
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      return { succeeded, total: data.userIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-data"] });
      toast.success(`Credits awarded to ${result.succeeded}/${result.total} users`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to bulk award credits: ${error.message}`);
    },
  });
}

// Export users to CSV
export function exportUsersToCSV(users: AdminUserData[]): void {
  const headers = [
    "User ID",
    "Email",
    "Display Name",
    "Phone",
    "City",
    "Mindset Level",
    "Access Status",
    "Created At",
    "Skills",
    "Passions",
    "Creative Roles",
    "Credit Balance",
    "Is Admin",
  ];

  const rows = users.map((u) => [
    u.user_id,
    u.email,
    u.display_name || "",
    u.phone || "",
    u.city || "",
    u.mindset_level?.toString() || "",
    u.access_status || "",
    u.created_at || "",
    u.skills.join("; "),
    u.passions.join("; "),
    u.creative_roles.join("; "),
    u.credit_balance.toString(),
    u.is_admin ? "Yes" : "No",
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `users_export_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast.success("Users exported to CSV");
}

// Toggle admin role
export function useToggleAdminRole() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { userId: string; makeAdmin: boolean }) => {
      if (!user?.id) throw new Error("Not authenticated");

      if (data.makeAdmin) {
        const { error } = await supabase.from("user_roles").insert([
          { user_id: data.userId, role: "admin" },
        ]);
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", data.userId)
          .eq("role", "admin");
        if (error) throw error;
      }

      await logAdminActionSafe({
        admin_id: user.id,
        action_type: data.makeAdmin ? "grant_admin" : "revoke_admin",
        target_user_id: data.userId,
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-data"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-actions"] });
      toast.success(data.makeAdmin ? "Admin role granted" : "Admin role revoked");
    },
    onError: (error: Error) => {
      console.error("Toggle admin role error:", error);
      toast.error(`Failed to update admin role: ${error.message}`);
    },
  });
}

// Send individual message
export function useSendIndividualMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      userId: string;
      title: string;
      message: string;
      sendDm: boolean;
      sendEmail: boolean;
      sendSms: boolean;
    }) => {
      const { data: result, error } = await supabase.functions.invoke("send-individual-message", {
        body: {
          target_user_id: data.userId,
          title: data.title,
          message: data.message,
          delivery_methods: {
            dm: data.sendDm,
            email: data.sendEmail,
            sms: data.sendSms,
          },
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-actions"] });
      toast.success("Message sent successfully");
    },
    onError: (error: Error) => {
      console.error("Send individual message error:", error);
      toast.error(`Failed to send message: ${error.message}`);
    },
  });
}

// Send message to multiple selected users
export function useSendMultiUserMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      userIds: string[];
      title: string;
      message: string;
      sendDm: boolean;
      sendEmail: boolean;
      sendSms: boolean;
    }) => {
      const results = await Promise.allSettled(
        data.userIds.map(async (userId) => {
          const { data: result, error } = await supabase.functions.invoke("send-individual-message", {
            body: {
              target_user_id: userId,
              title: data.title,
              message: data.message,
              delivery_methods: {
                dm: data.sendDm,
                email: data.sendEmail,
                sms: data.sendSms,
              },
            },
          });

          if (error) throw error;
          if (result?.error) throw new Error(result.error);

          return { userId, result };
        })
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      
      return { succeeded, failed, total: data.userIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-actions"] });
      toast.success(`Message sent to ${result.succeeded}/${result.total} users`);
    },
    onError: (error: Error) => {
      console.error("Send multi-user message error:", error);
      toast.error(`Failed to send messages: ${error.message}`);
    },
  });
}
