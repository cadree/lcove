import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UserSkill {
  id: string;
  name: string;
  category: string | null;
}

interface UserPassion {
  id: string;
  name: string;
  category: string | null;
}

interface UserCreativeRole {
  id: string;
  name: string;
  category: string | null;
}

export function useUserSkills(userId?: string) {
  return useQuery({
    queryKey: ['user-skills', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_skills')
        .select(`
          skill_id,
          skills (id, name, category)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      
      return (data || []).map((item: any) => item.skills).filter(Boolean) as UserSkill[];
    },
    enabled: !!userId,
  });
}

export function useUserPassions(userId?: string) {
  return useQuery({
    queryKey: ['user-passions', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_passions')
        .select(`
          passion_id,
          passions (id, name, category)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      
      return (data || []).map((item: any) => item.passions).filter(Boolean) as UserPassion[];
    },
    enabled: !!userId,
  });
}

export function useUserCreativeRoles(userId?: string) {
  return useQuery({
    queryKey: ['user-creative-roles', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_creative_roles')
        .select(`
          role_id,
          creative_roles (id, name, category)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      
      return (data || []).map((item: any) => item.creative_roles).filter(Boolean) as UserCreativeRole[];
    },
    enabled: !!userId,
  });
}
