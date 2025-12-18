import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ThemePreset } from "@/lib/profileThemes";

export interface ProfileCustomization {
  id: string;
  user_id: string;
  // Background
  background_type: 'color' | 'gradient' | 'image';
  background_value: string;
  background_opacity: number;
  background_blur: number;
  // Overlay
  overlay_tint: string | null;
  overlay_opacity: number;
  // Theme
  theme_preset: ThemePreset;
  theme_accent_color: string | null;
  accent_color_override: string | null;
  custom_font: string | null;
  // Effects
  effect_grain: boolean;
  effect_neon_glow: boolean;
  effect_scanlines: boolean;
  effect_holographic: boolean;
  effect_motion_gradient: boolean;
  // Layout
  section_order: string[];
  show_top_friends: boolean;
  // Music
  profile_music_url: string | null;
  profile_music_enabled: boolean;
  profile_music_title: string | null;
  profile_music_artist: string | null;
  profile_music_source: 'spotify' | 'apple_music' | 'upload' | null;
  profile_music_album_art_url: string | null;
  profile_music_album_name: string | null;
  profile_music_preview_url: string | null;
  profile_music_external_id: string | null;
  music_visualizer_enabled: boolean;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export const DEFAULT_CUSTOMIZATION: Partial<ProfileCustomization> = {
  theme_preset: 'clean_modern',
  background_type: 'gradient',
  background_value: 'from-primary/30 via-background to-accent/20',
  background_opacity: 1,
  background_blur: 0,
  overlay_tint: null,
  overlay_opacity: 0,
  effect_grain: false,
  effect_neon_glow: false,
  effect_scanlines: false,
  effect_holographic: false,
  effect_motion_gradient: false,
  custom_font: null,
  accent_color_override: null,
  section_order: ['about', 'music', 'stats', 'links'],
  show_top_friends: false,
  profile_music_enabled: false,
  music_visualizer_enabled: false,
};

export const useProfileCustomization = (userId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const targetUserId = userId || user?.id;

  const { data: customization, isLoading } = useQuery({
    queryKey: ["profile-customization", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;
      
      const { data, error } = await supabase
        .from("profile_customizations")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (error) throw error;
      return data as ProfileCustomization | null;
    },
    enabled: !!targetUserId,
  });

  const saveCustomization = useMutation({
    mutationFn: async (customizationData: Partial<ProfileCustomization>) => {
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("profile_customizations")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("profile_customizations")
          .update({
            ...customizationData,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profile_customizations")
          .insert({
            user_id: user.id,
            ...customizationData,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-customization", user?.id] });
      toast.success("Profile customization saved!");
    },
    onError: (error) => {
      toast.error("Failed to save customization");
      console.error(error);
    },
  });

  const isOwner = user?.id === targetUserId;

  // Merge with defaults for complete state
  const mergedCustomization = customization 
    ? { ...DEFAULT_CUSTOMIZATION, ...customization }
    : null;

  return {
    customization: mergedCustomization as ProfileCustomization | null,
    rawCustomization: customization,
    isLoading,
    saveCustomization,
    isOwner,
  };
};
