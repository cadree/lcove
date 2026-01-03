import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export interface ProfileSection {
  id: string;
  label: string;
  visible: boolean;
  size: 'small' | 'medium' | 'large';
  order: number;
}

export const DEFAULT_SECTIONS: ProfileSection[] = [
  { id: 'stats', label: 'Stats', visible: true, size: 'medium', order: 0 },
  { id: 'friends', label: 'Friends', visible: true, size: 'medium', order: 1 },
  { id: 'about', label: 'About', visible: true, size: 'medium', order: 2 },
  { id: 'pipeline', label: 'My Pipeline', visible: true, size: 'large', order: 3 },
  { id: 'boards', label: 'Boards', visible: true, size: 'medium', order: 4 },
  { id: 'portfolio', label: 'Portfolio', visible: true, size: 'medium', order: 5 },
  { id: 'store', label: 'My Store', visible: true, size: 'medium', order: 6 },
  { id: 'calendar', label: 'Calendar', visible: true, size: 'medium', order: 7 },
  { id: 'creator_modules', label: 'Creator Modules', visible: true, size: 'medium', order: 8 },
  { id: 'music', label: 'Music Player', visible: true, size: 'medium', order: 9 },
  { id: 'posts_tabs', label: 'Posts & Blogs', visible: true, size: 'large', order: 10 },
  { id: 'reviews', label: 'Reviews', visible: true, size: 'medium', order: 11 },
  { id: 'quick_links', label: 'Quick Links', visible: true, size: 'small', order: 12 },
];

const parseLayoutFromJson = (json: Json | null): ProfileSection[] => {
  if (!json || !Array.isArray(json)) return DEFAULT_SECTIONS;
  
  try {
    const parsed = json.map((item: Json) => {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const obj = item as Record<string, Json>;
        return {
          id: String(obj.id || ''),
          label: String(obj.label || ''),
          visible: Boolean(obj.visible),
          size: (obj.size as 'small' | 'medium' | 'large') || 'medium',
          order: Number(obj.order) || 0,
        };
      }
      return null;
    }).filter((item): item is ProfileSection => item !== null && item.id !== '');
    
    if (parsed.length === 0) return DEFAULT_SECTIONS;
    
    // Merge with defaults to handle new sections
    const savedIds = new Set(parsed.map(s => s.id));
    const newSections = DEFAULT_SECTIONS.filter(s => !savedIds.has(s.id))
      .map((s, i) => ({ ...s, order: parsed.length + i }));
    return [...parsed, ...newSections].sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_SECTIONS;
  }
};

const layoutToJson = (sections: ProfileSection[]): Json => {
  return sections.map(s => ({
    id: s.id,
    label: s.label,
    visible: s.visible,
    size: s.size,
    order: s.order,
  })) as unknown as Json;
};

export const useProfileLayout = (userId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const targetUserId = userId || user?.id;

  const { data: layout, isLoading } = useQuery({
    queryKey: ["profile-layout", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return DEFAULT_SECTIONS;
      
      const { data, error } = await supabase
        .from("profile_customizations")
        .select("profile_layout")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (error) throw error;
      
      return parseLayoutFromJson(data?.profile_layout || null);
    },
    enabled: !!targetUserId,
  });

  const saveLayout = useMutation({
    mutationFn: async (sections: ProfileSection[]) => {
      if (!user) throw new Error("Not authenticated");

      const layoutJson = layoutToJson(sections);

      const { data: existing } = await supabase
        .from("profile_customizations")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("profile_customizations")
          .update({
            profile_layout: layoutJson,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profile_customizations")
          .insert({
            user_id: user.id,
            profile_layout: layoutJson,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-layout", user?.id] });
      toast.success("Layout saved!");
    },
    onError: () => {
      toast.error("Failed to save layout");
    },
  });

  const isOwner = user?.id === targetUserId;

  return {
    layout: layout || DEFAULT_SECTIONS,
    isLoading,
    saveLayout,
    isOwner,
  };
};
