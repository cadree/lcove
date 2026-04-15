import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UserSkill {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
}

interface UserPassion {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
}

interface UserCreativeRole {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
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
          description,
          skills (id, name, category)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      
      return (data || []).map((item: any) => ({
        ...item.skills,
        description: item.description,
      })).filter((item: any) => item.id) as UserSkill[];
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
          description,
          passions (id, name, category)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      
      return (data || []).map((item: any) => ({
        ...item.passions,
        description: item.description,
      })).filter((item: any) => item.id) as UserPassion[];
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
          description,
          creative_roles (id, name, category)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      
      return (data || []).map((item: any) => ({
        ...item.creative_roles,
        description: item.description,
      })).filter((item: any) => item.id) as UserCreativeRole[];
    },
    enabled: !!userId,
  });
}
