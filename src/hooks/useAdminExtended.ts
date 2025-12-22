import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "./useAdmin";
import { toast } from "sonner";

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
  const { error } = await supabase.from("admin_actions").insert(payload);
  if (error) {
    // IMPORTANT: do not throw — logging should never break core admin flows
    console.warn("Admin action log failed (non-blocking):", error);
  }
}

// Fetch all users with emails using the admin function
export function useAdminUserData() {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ["admin-user-data"],
    enabled: isAdmin,
    queryFn: async (): Promise<AdminUserData[]> => {
      // Pull main user rows from secure RPC
      const { data: userData, error: userError } = await supabase.rpc("get_admin_user_data");
      if (userError) throw userError;

      // Fetch related tables in parallel
      const [skillsRes, passionsRes, rolesRes, creditsRes, adminRolesRes] = await Promise.all([
        supabase.from("user_skills").select("user_id, skills(name)"),
        supabase.from("user_passions").select("user_id, passions(name)"),
        supabase.from("user_creative_roles").select("user_id, creative_roles(name)"),
        supabase.from("user_credits").select("user_id, balance"),
        supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      ]);

      if (skillsRes.error) throw skillsRes.error;
      if (passionsRes.error) throw passionsRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (creditsRes.error) throw creditsRes.error;
      if (adminRolesRes.error) throw adminRolesRes.error;

      const allUserSkills = skillsRes.data ?? [];
      const allUserPassions = passionsRes.data ?? [];
      const allUserRoles = rolesRes.data ?? [];
      const allUserCredits = creditsRes.data ?? [];
      const adminRoles = adminRolesRes.data ?? [];

      // Build maps
      const skillsMap = new Map<string, string[]>();
      const passionsMap = new Map<string, string[]>();
      const rolesMap = new Map<string, string[]>();
      const creditsMap = new Map<string, number>();
      const adminSet = new Set<string>();

      for (const item of allUserSkills as any[]) {
        const arr = skillsMap.get(item.user_id) || [];
        if (item.skills?.name) arr.push(item.skills.name);
        skillsMap.set(item.user_id, arr);
      }

      for (const item of allUserPassions as any[]) {
        const arr = passionsMap.get(item.user_id) || [];
        if (item.passions?.name) arr.push(item.passions.name);
        passionsMap.set(item.user_id, arr);
      }

      for (const item of allUserRoles as any[]) {
        const arr = rolesMap.get(item.user_id) || [];
        if (item.creative_roles?.name) arr.push(item.creative_roles.name);
        rolesMap.set(item.user_id, arr);
      }

      for (const item of allUserCredits as any[]) {
        creditsMap.set(item.user_id, item.balance || 0);
      }

      for (const item of adminRoles as any[]) {
        adminSet.add(item.user_id);
      }

      return (userData || []).map((user: any) => ({
        ...user,
        skills: skillsMap.get(user.user_id) || [],
        passions: passionsMap.get(user.user_id) || [],
        creative_roles: rolesMap.get(user.user_id) || [],
        credit_balance: creditsMap.get(user.user_id) || 0,
        is_admin: adminSet.has(user.user_id),
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
      toast.success(`Notification sent to ${result.recipientCount} users`);
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

      const { error: ledgerError } = await supabase.from("credit_ledger").insert({
        user_id: data.userId,
        amount: data.amount,
        balance_after: newBalance,
        type: data.amount > 0 ? "admin_award" : "admin_deduct",
        description: data.reason,
      });

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

// Bulk award credits to all users
export function useBulkAwardCredits() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      amount: number;
      reason: string;
      targetAudience?: { type: "all" | "mindset_level" | "city"; value?: string | number };
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      let query = supabase.from("profiles").select("user_id").eq("is_suspended", false);

      const targetAudience = data.targetAudience || { type: "all" as const };

      if (targetAudience.type === "mindset_level" && targetAudience.value !== undefined) {
        query = query.eq("mindset_level", Number(targetAudience.value));
      } else if (targetAudience.type === "city" && targetAudience.value) {
        query = query.ilike("city", `%${String(targetAudience.value)}%`);
      }

      const { data: targetUsers, error: usersError } = await query;
      if (usersError) throw usersError;

      if (!targetUsers || targetUsers.length === 0) {
        throw new Error("No users match the criteria");
      }

      const { data: currentBalances, error: balErr } = await supabase
        .from("user_credits")
        .select("user_id, balance")
        .in(
          "user_id",
          targetUsers.map((u: any) => u.user_id),
        );

      if (balErr) throw balErr;

      const balanceMap = new Map((currentBalances || []).map((c: any) => [c.user_id, c.balance || 0]));

      const ledgerEntries = targetUsers.map((u: any) => ({
        user_id: u.user_id,
        amount: data.amount,
        balance_after: (balanceMap.get(u.user_id) || 0) + data.amount,
        type: "admin_bulk_award",
        description: data.reason,
      }));

      const batchSize = 100;
      for (let i = 0; i < ledgerEntries.length; i += batchSize) {
        const batch = ledgerEntries.slice(i, i + batchSize);
        const { error } = await supabase.from("credit_ledger").insert(batch);
        if (error) throw error;
      }

      await logAdminActionSafe({
        admin_id: user.id,
        action_type: "bulk_award_credits",
        target_user_id: user.id,
        reason: data.reason,
        metadata: {
          amount: data.amount,
          recipient_count: targetUsers.length,
          target_audience: targetAudience,
        },
      });

      return { recipientCount: targetUsers.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-data"] });
      queryClient.invalidateQueries({ queryKey: ["admin-actions"] });
      toast.success(`Awarded credits to ${result.recipientCount} users`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to award credits: ${error.message}`);
    },
  });
}

// Export user data to CSV
export function exportUsersToCSV(users: AdminUserData[]) {
  const headers = [
    "Name",
    "Email",
    "Phone",
    "City",
    "Mindset Level",
    "Access Status",
    "Credits",
    "Skills",
    "Passions",
    "Creative Roles",
    "Joined",
  ];

  const rows = users.map((user) => [
    user.display_name || "",
    user.email || "",
    user.phone || "",
    user.city || "",
    user.mindset_level?.toString() || "",
    user.access_status || "",
    user.credit_balance?.toString() || "0",
    user.skills.join("; "),
    user.passions.join("; "),
    user.creative_roles.join("; "),
    user.created_at ? new Date(user.created_at).toLocaleDateString() : "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `users_export_${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Toggle admin role for a user
export function useToggleAdminRole() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { userId: string; isAdmin: boolean }) => {
      if (!user?.id) throw new Error("Not authenticated");

      if (data.isAdmin) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");

        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({
          user_id: data.userId,
          role: "admin",
          granted_by: user.id,
        });

        if (error) throw error;
      }

      // BEST-EFFORT LOGGING (won't break the role update if DB constraint blocks it)
      await logAdminActionSafe({
        admin_id: user.id,
        action_type: data.isAdmin ? "remove_admin" : "grant_admin",
        target_user_id: data.userId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-data"] });
      queryClient.invalidateQueries({ queryKey: ["admin-actions"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      toast.success(variables.isAdmin ? "Admin role removed" : "Admin role granted");
    },
    onError: (error: Error) => {
      console.error("Failed to update admin role:", error);
      toast.error(`Failed to update admin role: ${error.message}`);
    },
  });
}

// Send individual message to a user
export function useSendIndividualMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      targetUserId: string;
      title: string;
      message: string;
      deliveryMethods: { email: boolean; sms: boolean; dm: boolean };
    }) => {
      const { data: result, error } = await supabase.functions.invoke("send-individual-message", {
        body: {
          target_user_id: data.targetUserId,
          title: data.title,
          message: data.message,
          delivery_methods: data.deliveryMethods,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-actions"] });

      const sent: string[] = [];
      if (result.results?.email?.sent) sent.push("email");
      if (result.results?.sms?.sent) sent.push("SMS");
      if (result.results?.dm?.sent) sent.push("in-app");

      if (sent.length > 0) {
        toast.success(`Message sent via: ${sent.join(", ")}`);
      } else {
        toast.error("No messages were delivered");
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to send message: ${error.message}`);
    },
  });
}
