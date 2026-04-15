import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MusicProfile {
  id: string;
  user_id: string;
  spotify_artist_id?: string;
  spotify_artist_url?: string;
  apple_music_artist_id?: string;
  apple_music_artist_url?: string;
  display_name?: string;
  artist_image_url?: string;
  created_at: string;
  updated_at: string;
}

export const useMusicProfile = (userId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const targetUserId = userId || user?.id;

  const { data: musicProfile, isLoading } = useQuery({
    queryKey: ["music-profile", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;

      const { data, error } = await supabase
        .from("music_profiles")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        return {
          id: data.id,
          user_id: data.user_id,
          spotify_artist_id: data.spotify_artist_id,
          spotify_artist_url: data.spotify_artist_url,
          apple_music_artist_id: data.apple_music_artist_id,
          apple_music_artist_url: data.apple_music_artist_url,
          display_name: data.display_name,
          artist_image_url: data.artist_image_url,
          created_at: data.created_at,
          updated_at: data.updated_at,
        } as MusicProfile;
      }
      return null;
    },
    enabled: !!targetUserId,
  });

  const saveMusicProfile = useMutation({
    mutationFn: async (profileData: Partial<MusicProfile>) => {
      if (!user) throw new Error("Not authenticated");

      const dataToSave = {
        spotify_artist_id: profileData.spotify_artist_id,
        spotify_artist_url: profileData.spotify_artist_url,
        apple_music_artist_id: profileData.apple_music_artist_id,
        apple_music_artist_url: profileData.apple_music_artist_url,
        display_name: profileData.display_name,
        artist_image_url: profileData.artist_image_url,
      };

      const { data: existing } = await supabase
        .from("music_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("music_profiles")
          .update({ ...dataToSave, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("music_profiles")
          .insert({ user_id: user.id, ...dataToSave });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["music-profile", user?.id] });
      toast.success("Music profile saved!");
    },
    onError: (error) => {
      toast.error("Failed to save music profile");
      console.error(error);
    },
  });

  const deleteMusicProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("music_profiles")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["music-profile", user?.id] });
      toast.success("Music profile removed");
    },
    onError: (error) => {
      toast.error("Failed to remove music profile");
      console.error(error);
    },
  });

  const isOwner = user?.id === targetUserId;

  return {
    musicProfile,
    isLoading,
    saveMusicProfile,
    deleteMusicProfile,
    isOwner,
  };
};
