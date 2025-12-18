import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface MusicTrack {
  id: string;
  name: string;
  preview_url?: string;
  duration_ms?: number;
  album_name?: string;
  album_image?: string;
  spotify_url?: string;
  apple_music_url?: string;
}

export interface MusicAlbum {
  id: string;
  name: string;
  image_url?: string;
  release_date?: string;
  total_tracks?: number;
  spotify_url?: string;
  apple_music_url?: string;
  type?: 'album' | 'single' | 'ep';
}

export interface MusicProfile {
  id: string;
  user_id: string;
  spotify_artist_id?: string;
  spotify_artist_url?: string;
  apple_music_artist_id?: string;
  apple_music_artist_url?: string;
  display_name?: string;
  artist_image_url?: string;
  genres?: string[];
  top_tracks: MusicTrack[];
  albums: MusicAlbum[];
  latest_release?: MusicAlbum;
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
          ...data,
          top_tracks: (data.top_tracks as unknown as MusicTrack[]) || [],
          albums: (data.albums as unknown as MusicAlbum[]) || [],
          latest_release: data.latest_release as unknown as MusicAlbum | undefined,
        } as MusicProfile;
      }
      return null;
    },
    enabled: !!targetUserId,
  });

  const saveMusicProfile = useMutation({
    mutationFn: async (profileData: Partial<MusicProfile>) => {
      if (!user) throw new Error("Not authenticated");

      const dataToSave: {
        spotify_artist_id?: string;
        spotify_artist_url?: string;
        apple_music_artist_id?: string;
        apple_music_artist_url?: string;
        display_name?: string;
        artist_image_url?: string;
        genres?: string[];
        top_tracks?: Json;
        albums?: Json;
        latest_release?: Json;
      } = {
        spotify_artist_id: profileData.spotify_artist_id,
        spotify_artist_url: profileData.spotify_artist_url,
        apple_music_artist_id: profileData.apple_music_artist_id,
        apple_music_artist_url: profileData.apple_music_artist_url,
        display_name: profileData.display_name,
        artist_image_url: profileData.artist_image_url,
        genres: profileData.genres,
        top_tracks: (profileData.top_tracks || []) as unknown as Json,
        albums: (profileData.albums || []) as unknown as Json,
        latest_release: (profileData.latest_release || null) as unknown as Json,
      };

      const { data: existing } = await supabase
        .from("music_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("music_profiles")
          .update({
            ...dataToSave,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("music_profiles")
          .insert({
            user_id: user.id,
            ...dataToSave,
          });
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
