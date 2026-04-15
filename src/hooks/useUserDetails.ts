import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserSkill {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  isCustom?: boolean;
}

export interface UserPassion {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  isCustom?: boolean;
}

export interface UserCreativeRole {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  isCustom?: boolean;
}

export function useUserSkills(userId?: string) {
  return useQuery({
    queryKey: ['user-skills', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_skills')
        .select(`
          id,
          skill_id,
          description,
          custom_name,
          skills (id, name, category)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      
      return (data || []).map((item: any) => {
        if (item.custom_name && !item.skill_id) {
          return {
            id: `custom-${item.id}`,
            name: item.custom_name,
            category: 'Custom',
            description: item.description,
            isCustom: true,
          };
        }
        return {
          ...item.skills,
          description: item.description,
          isCustom: false,
        };
      }).filter((item: any) => item.name) as UserSkill[];
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
          id,
          passion_id,
          description,
          custom_name,
          passions (id, name, category)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      
      return (data || []).map((item: any) => {
        if (item.custom_name && !item.passion_id) {
          return {
            id: `custom-${item.id}`,
            name: item.custom_name,
            category: 'Custom',
            description: item.description,
            isCustom: true,
          };
        }
        return {
          ...item.passions,
          description: item.description,
          isCustom: false,
        };
      }).filter((item: any) => item.name) as UserPassion[];
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
          id,
          role_id,
          description,
          custom_name,
          creative_roles (id, name, category)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      
      return (data || []).map((item: any) => {
        if (item.custom_name && !item.role_id) {
          return {
            id: `custom-${item.id}`,
            name: item.custom_name,
            category: 'Custom',
            description: item.description,
            isCustom: true,
          };
        }
        return {
          ...item.creative_roles,
          description: item.description,
          isCustom: false,
        };
      }).filter((item: any) => item.name) as UserCreativeRole[];
    },
    enabled: !!userId,
  });
}
