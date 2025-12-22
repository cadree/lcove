import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
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
        .from('profiles')
        .select('*')
        .eq('onboarding_completed', false)
        .not('onboarding_score', 'is', null)
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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { userId: string; reason: string }) => {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_suspended: true,
          suspended_at: new Date().toISOString(),
          suspension_reason: data.reason,
        })
        .eq('user_id', data.userId);

      if (profileError) throw profileError;

      // Log action
      const { error: actionError } = await supabase
        .from('admin_actions')
        .insert({
          admin_id: user?.id,
          action_type: 'suspend',
          target_user_id: data.userId,
          reason: data.reason,
        });

      if (actionError) throw actionError;
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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_suspended: false,
          suspended_at: null,
          suspension_reason: null,
        })
        .eq('user_id', userId);

      if (profileError) throw profileError;

      const { error: actionError } = await supabase
        .from('admin_actions')
        .insert({
          admin_id: user?.id,
          action_type: 'unsuspend',
          target_user_id: userId,
        });

      if (actionError) throw actionError;
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

export function useDenyOnboarding() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { userId: string; reason: string }) => {
      // Use type assertion for new columns not yet in generated types
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          access_level: 'level_1',
          mindset_level: 1,
          access_status: 'denied',
        } as Record<string, unknown>)
        .eq('user_id', data.userId);

      if (profileError) throw profileError;

      const { error: actionError } = await supabase
        .from('admin_actions')
        .insert({
          admin_id: user?.id,
          action_type: 'deny_onboarding',
          target_user_id: data.userId,
          reason: data.reason,
        });

      if (actionError) throw actionError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-data'] });
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] });
      toast.success('Onboarding denied');
    },
    onError: (error: Error) => {
      console.error('Failed to deny onboarding:', error);
      toast.error(`Failed to deny onboarding: ${error.message}`);
    },
  });
}

export function useChangeAccessStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { userId: string; status: 'active' | 'denied' | 'banned'; reason?: string }) => {
      // Use type assertion for new column not yet in generated types
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          access_status: data.status,
        } as Record<string, unknown>)
        .eq('user_id', data.userId);

      if (profileError) throw profileError;

      const { error: actionError } = await supabase
        .from('admin_actions')
        .insert({
          admin_id: user?.id,
          action_type: `change_status_${data.status}`,
          target_user_id: data.userId,
          reason: data.reason || null,
        });

      if (actionError) throw actionError;
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
        .select(`
          *,
          profile:profiles!user_id(display_name, avatar_url, user_id)
        `)
        .lt('overall_score', 2)
        .order('overall_score', { ascending: true });

      if (error) throw error;
      return data;
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
        .from('profiles')
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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { userId: string; reason?: string }) => {
      // First, update profile to mark as deleted/banned
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          access_status: 'banned',
          is_suspended: true,
          suspended_at: new Date().toISOString(),
          suspension_reason: data.reason || 'Account removed by admin',
        } as Record<string, unknown>)
        .eq('user_id', data.userId);

      if (profileError) throw profileError;

      // Log the action
      const { error: actionError } = await supabase
        .from('admin_actions')
        .insert({
          admin_id: user?.id,
          action_type: 'remove_user',
          target_user_id: data.userId,
          reason: data.reason || 'Removed by admin',
        });

      if (actionError) throw actionError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-data'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-detailed'] });
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] });
      toast.success('User removed from the app');
    },
    onError: () => {
      toast.error('Failed to remove user');
    },
  });
}
