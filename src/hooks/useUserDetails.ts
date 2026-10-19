import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function relatedSkill(relation: unknown): { id: string; name: string; category: string | null } | null {
  const row = Array.isArray(relation) ? relation[0] : relation;
  if (!row || typeof row !== "object") return null;
  if (!("id" in row) || !("name" in row)) return null;
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  const category = "category" in row && (typeof row.category === "string" || row.category === null) ? row.category : null;
  return { id: row.id, name: row.name, category };
}

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
      
      return (data || []).flatMap((item): UserSkill[] => {
        if (item.custom_name && !item.skill_id) {
          return [{
            id: `custom-${item.id}`,
            name: item.custom_name,
            category: 'Custom',
            description: item.description,
            isCustom: true,
          }];
        }
        const skill = relatedSkill(item.skills);
        if (!skill?.name) return [];
        return [{
          ...skill,
          description: item.description,
          isCustom: false,
        }];
      });
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
      
      return (data || []).flatMap((item): UserPassion[] => {
        if (item.custom_name && !item.passion_id) {
          return [{
            id: `custom-${item.id}`,
            name: item.custom_name,
            category: 'Custom',
            description: item.description,
            isCustom: true,
          }];
        }
        const passion = relatedSkill(item.passions);
        if (!passion?.name) return [];
        return [{
          ...passion,
          description: item.description,
          isCustom: false,
        }];
      });
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
      
      return (data || []).flatMap((item): UserCreativeRole[] => {
        if (item.custom_name && !item.role_id) {
          return [{
            id: `custom-${item.id}`,
            name: item.custom_name,
            category: 'Custom',
            description: item.description,
            isCustom: true,
          }];
        }
        const role = relatedSkill(item.creative_roles);
        if (!role?.name) return [];
        return [{
          ...role,
          description: item.description,
          isCustom: false,
        }];
      });
    },
    enabled: !!userId,
  });
}
