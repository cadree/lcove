import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { callRpc } from '@/lib/rpc';

function relationName(relation: unknown): string | undefined {
  const row = Array.isArray(relation) ? relation[0] : relation;
  if (!row || typeof row !== "object" || !("name" in row)) return undefined;
  return typeof row.name === "string" ? row.name : undefined;
}

export type AppRole = 'admin' | 'moderator' | 'user';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  granted_by: string | null;
}

export interface AdminAction {
  id: string;
  admin_id: string;
  action_type: string;
  target_user_id: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useUserRoles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching user roles:', error);
        return [];
      }
      return data as UserRole[];
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useIsAdmin() {
  const { data: roles, isLoading } = useUserRoles();
  const isAdmin = roles?.some(r => r.role === 'admin') ?? false;
  return { isAdmin, isLoading };
}

export function useIsModerator() {
  const { data: roles, isLoading } = useUserRoles();
  const isModerator = roles?.some(r => r.role === 'admin' || r.role === 'moderator') ?? false;
  return { isModerator, isLoading };
}

export function useAllUsers() {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_public')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        phone: null as string | null,
        email: null as string | null,
        onboarding_score: null as number | null,
      }));
    },
    enabled: isAdmin,
  });
}

export function usePendingOnboarding() {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ['pending-onboarding'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_public')
        .select('*')
        .eq('onboarding_completed', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });
}

export function useAdminActions() {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ['admin-actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as AdminAction[];
    },
    enabled: isAdmin,
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; reason: string }) => {
      await callRpc('admin_set_user_access', {
        p_user_id: data.userId,
        p_action: 'suspend',
        p_reason: data.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-data'] });
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] });
      toast.success('User suspended');
    },
    onError: (error: Error) => {
      console.error('Failed to suspend user:', error);
      toast.error(`Failed to suspend user: ${error.message}`);
    },
  });
}

export function useUnsuspendUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      await callRpc('admin_set_user_access', {
        p_user_id: userId,
        p_action: 'unsuspend',
        p_reason: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-data'] });
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] });
      toast.success('User unsuspended');
    },
    onError: (error: Error) => {
      console.error('Failed to unsuspend user:', error);
      toast.error(`Failed to unsuspend user: ${error.message}`);
    },
  });
}

export function useApproveOnboarding() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { userId: string; level: number }) => {
      const accessLevel = data.level === 3 ? 'level_3' : data.level === 2 ? 'level_2' : 'level_1';

      // Use type assertion for new columns not yet in generated types
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          access_level: accessLevel,
          mindset_level: data.level,
          access_status: 'active',
        } as Record<string, unknown>)
        .eq('user_id', data.userId);

      if (profileError) throw profileError;

      const { error: actionError } = await supabase
        .from('admin_actions')
        .insert({
          admin_id: user?.id,
          action_type: 'approve_onboarding',
          target_user_id: data.userId,
          metadata: { level: data.level },
        });

      if (actionError) throw actionError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-data'] });
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] });
      toast.success('Onboarding approved');
    },
    onError: (error: Error) => {
      console.error('Failed to approve onboarding:', error);
      toast.error(`Failed to approve onboarding: ${error.message}`);
    },
  });
}

export function useChangeAccessStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; status: 'active' | 'pending' | 'banned'; reason?: string }) => {
      const action = data.status === 'banned' ? 'ban' : 'unban';
      await callRpc('admin_set_user_access', {
        p_user_id: data.userId,
        p_action: action,
        p_reason: data.reason ?? null,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-data'] });
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] });
      toast.success(`User status changed to ${variables.status}`);
    },
    onError: () => {
      toast.error('Failed to change user status');
    },
  });
}

export function useQuestionnaireResponses(userId: string) {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ['questionnaire-responses', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questionnaire_responses')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: isAdmin && !!userId,
  });
}

export function useLowReputationUsers() {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ['low-reputation-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reputation_scores')
        .select('*')
        .lt('overall_score', 2)
        .order('overall_score', { ascending: true });

      if (error) throw error;
      const userIds = [...new Set((data ?? []).map((row) => row.user_id))];
      const { data: profiles } = userIds.length
        ? await supabase
            .from('profiles_public')
            .select('user_id, display_name, avatar_url')
            .in('user_id', userIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
      return (data ?? []).map((row) => ({
        ...row,
        profile: profileMap.get(row.user_id) ?? null,
      }));
    },
    enabled: isAdmin,
  });
}

export function useAllUsersWithDetails() {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ['admin-users-detailed'],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles_public')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

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

      // Map skills/passions/roles to users
      const skillsMap = new Map<string, string[]>();
      const passionsMap = new Map<string, string[]>();
      const rolesMap = new Map<string, string[]>();

      allUserSkills?.forEach((item) => {
        const skills = skillsMap.get(item.user_id) || [];
        const name = relationName(item.skills);
        if (name) skills.push(name);
        skillsMap.set(item.user_id, skills);
      });

      allUserPassions?.forEach((item) => {
        const passions = passionsMap.get(item.user_id) || [];
        const name = relationName(item.passions);
        if (name) passions.push(name);
        passionsMap.set(item.user_id, passions);
      });

      allUserRoles?.forEach((item) => {
        const roles = rolesMap.get(item.user_id) || [];
        const name = relationName(item.creative_roles);
        if (name) roles.push(name);
        rolesMap.set(item.user_id, roles);
      });

      return profiles?.map(profile => ({
        ...profile,
        skills: skillsMap.get(profile.user_id) || [],
        passions: passionsMap.get(profile.user_id) || [],
        creative_roles: rolesMap.get(profile.user_id) || [],
      }));
    },
    enabled: isAdmin,
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; reason?: string }) => {
      await callRpc('admin_remove_user', {
        p_user_id: data.userId,
        p_reason: data.reason ?? null,
        p_hard: false,
        p_confirm: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-data'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-detailed'] });
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] });
      toast.success('User removed from the app');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove user');
    },
  });
}

export function useRestoreUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; reason?: string }) => {
      await callRpc('admin_restore_user', {
        p_user_id: data.userId,
        p_reason: data.reason ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-data'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-detailed'] });
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] });
      toast.success('Account restored');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to restore user');
    },
  });
}

export function useHardDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; confirm: string; reason?: string }) => {
      await callRpc('admin_remove_user', {
        p_user_id: data.userId,
        p_reason: data.reason ?? null,
        p_hard: true,
        p_confirm: data.confirm,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-data'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-detailed'] });
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] });
      toast.success('Account permanently deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete user');
    },
  });
}
