import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from './useAdmin';
import { toast } from 'sonner';

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
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  message: string;
  target_audience: {
    type: 'all' | 'mindset_level' | 'city';
    value?: string | number;
  };
  sent_by: string;
  sent_at: string;
  recipient_count: number;
}

// Fetch all users with emails using the admin function
export function useAdminUserData() {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ['admin-user-data'],
    queryFn: async (): Promise<AdminUserData[]> => {
      // Get user data using the secure admin function
      const { data: userData, error: userError } = await supabase
        .rpc('get_admin_user_data');

      if (userError) throw userError;

      // Get all user skills
      const { data: allUserSkills } = await supabase
        .from('user_skills')
        .select('user_id, skills(name)');

      // Get all user passions
      const { data: allUserPassions } = await supabase
        .from('user_passions')
        .select('user_id, passions(name)');

      // Get all user creative roles
      const { data: allUserRoles } = await supabase
        .from('user_creative_roles')
        .select('user_id, creative_roles(name)');

      // Get all user credits
      const { data: allUserCredits } = await supabase
        .from('user_credits')
        .select('user_id, balance');

      // Map skills/passions/roles/credits to users
      const skillsMap = new Map<string, string[]>();
      const passionsMap = new Map<string, string[]>();
      const rolesMap = new Map<string, string[]>();
      const creditsMap = new Map<string, number>();

      allUserSkills?.forEach((item: any) => {
        const skills = skillsMap.get(item.user_id) || [];
        if (item.skills?.name) skills.push(item.skills.name);
        skillsMap.set(item.user_id, skills);
      });

      allUserPassions?.forEach((item: any) => {
        const passions = passionsMap.get(item.user_id) || [];
        if (item.passions?.name) passions.push(item.passions.name);
        passionsMap.set(item.user_id, passions);
      });

      allUserRoles?.forEach((item: any) => {
        const roles = rolesMap.get(item.user_id) || [];
        if (item.creative_roles?.name) roles.push(item.creative_roles.name);
        rolesMap.set(item.user_id, roles);
      });

      allUserCredits?.forEach((item: any) => {
        creditsMap.set(item.user_id, item.balance || 0);
      });

      return (userData || []).map((user: any) => ({
        ...user,
        skills: skillsMap.get(user.user_id) || [],
        passions: passionsMap.get(user.user_id) || [],
        creative_roles: rolesMap.get(user.user_id) || [],
        credit_balance: creditsMap.get(user.user_id) || 0,
      }));
    },
    enabled: isAdmin,
  });
}

// Fetch announcement history
export function useAdminAnnouncements() {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_announcements')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Transform the data to match our interface
      return (data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        target_audience: item.target_audience as AdminAnnouncement['target_audience'],
        sent_by: item.sent_by,
        sent_at: item.sent_at,
        recipient_count: item.recipient_count,
      }));
    },
    enabled: isAdmin,
  });
}

// Send mass notification
export function useSendMassNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      message: string;
      targetAudience: { type: 'all' | 'mindset_level' | 'city'; value?: string | number };
    }) => {
      const { data: result, error } = await supabase.functions.invoke('send-mass-notification', {
        body: data,
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] });
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
    mutationFn: async (data: {
      userId: string;
      amount: number; // positive for add, negative for deduct
      reason: string;
    }) => {
      // Get current balance
      const { data: currentCredits } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', data.userId)
        .single();

      const currentBalance = currentCredits?.balance || 0;
      const newBalance = currentBalance + data.amount;

      if (newBalance < 0) {
        throw new Error('Cannot deduct more credits than available');
      }

      // Add credit ledger entry
      const { error: ledgerError } = await supabase
        .from('credit_ledger')
        .insert({
          user_id: data.userId,
          amount: data.amount,
          balance_after: newBalance,
          type: data.amount > 0 ? 'admin_award' : 'admin_deduct',
          description: data.reason,
        });

      if (ledgerError) throw ledgerError;

      // Log admin action
      await supabase.from('admin_actions').insert({
        admin_id: user?.id,
        action_type: data.amount > 0 ? 'award_credits' : 'deduct_credits',
        target_user_id: data.userId,
        reason: data.reason,
        metadata: { amount: data.amount, new_balance: newBalance },
      });

      return { newBalance };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-data'] });
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] });
      toast.success('Credits adjusted successfully');
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
      targetAudience?: { type: 'all' | 'mindset_level' | 'city'; value?: string | number };
    }) => {
      // Get target users
      let query = supabase
        .from('profiles')
        .select('user_id')
        .eq('is_suspended', false);

      const targetAudience = data.targetAudience || { type: 'all' as const };
      
      if (targetAudience.type === 'mindset_level' && targetAudience.value !== undefined) {
        query = query.eq('mindset_level', Number(targetAudience.value));
      } else if (targetAudience.type === 'city' && targetAudience.value) {
        query = query.ilike('city', `%${String(targetAudience.value)}%`);
      }

      const { data: targetUsers, error: usersError } = await query;
      if (usersError) throw usersError;

      if (!targetUsers || targetUsers.length === 0) {
        throw new Error('No users match the criteria');
      }

      // Get current balances
      const { data: currentBalances } = await supabase
        .from('user_credits')
        .select('user_id, balance')
        .in('user_id', targetUsers.map(u => u.user_id));

      const balanceMap = new Map(currentBalances?.map(c => [c.user_id, c.balance || 0]) || []);

      // Create ledger entries for each user
      const ledgerEntries = targetUsers.map(u => ({
        user_id: u.user_id,
        amount: data.amount,
        balance_after: (balanceMap.get(u.user_id) || 0) + data.amount,
        type: 'admin_bulk_award',
        description: data.reason,
      }));

      // Insert in batches
      const batchSize = 100;
      for (let i = 0; i < ledgerEntries.length; i += batchSize) {
        const batch = ledgerEntries.slice(i, i + batchSize);
        await supabase.from('credit_ledger').insert(batch);
      }

      // Log admin action
      await supabase.from('admin_actions').insert({
        admin_id: user?.id,
        action_type: 'bulk_award_credits',
        target_user_id: user?.id,
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
      queryClient.invalidateQueries({ queryKey: ['admin-user-data'] });
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] });
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
    'Name',
    'Email',
    'Phone',
    'City',
    'Mindset Level',
    'Access Status',
    'Credits',
    'Skills',
    'Passions',
    'Creative Roles',
    'Joined',
  ];

  const rows = users.map(user => [
    user.display_name || '',
    user.email || '',
    user.phone || '',
    user.city || '',
    user.mindset_level?.toString() || '',
    user.access_status || '',
    user.credit_balance?.toString() || '0',
    user.skills.join('; '),
    user.passions.join('; '),
    user.creative_roles.join('; '),
    user.created_at ? new Date(user.created_at).toLocaleDateString() : '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}