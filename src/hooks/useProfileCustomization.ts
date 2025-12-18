import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProfileCustomization {
  id: string;
  user_id: string;
  background_type: 'color' | 'gradient' | 'image';
  background_value: string;
  theme_accent_color: string | null;
  profile_music_url: string | null;
  profile_music_enabled: boolean;
  profile_music_title: string | null;
  profile_music_artist: string | null;
  created_at: string;
  updated_at: string;
}

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

  return {
    customization,
    isLoading,
    saveCustomization,
    isOwner,
  };
};
