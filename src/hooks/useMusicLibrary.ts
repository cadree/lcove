import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ExclusiveTrack } from "./useExclusiveMusic";

export interface MusicSave {
  id: string;
  user_id: string;
  track_id: string;
  added_to_profile: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedTrackWithMeta extends MusicSave {
  track: ExclusiveTrack & {
    artist?: { display_name: string | null; avatar_url: string | null } | null;
  };
}

/**
 * All tracks the current user has VERIFIED-PAID for.
 *
 * CRITICAL: only `payment_status = 'paid'` rows count as access. Pending rows
 * are inserted the moment a Checkout Session is created and must NEVER unlock
 * a track — otherwise an abandoned/canceled checkout would grant free access.
 */
export const useMyPurchases = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-exclusive-purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("exclusive_track_purchases")
        .select("*")
        .eq("buyer_user_id", user.id)
        .eq("payment_status", "paid");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
};

/** All saves for the current user (their library). */
export const useMySaves = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-music-saves", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("music_saves")
        .select("*, track:exclusive_tracks(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SavedTrackWithMeta[];
    },
    enabled: !!user?.id,
  });
};

/** Public query: tracks a given profile owner has saved AND chosen to display. */
export const useSavedTracksForProfile = (profileUserId?: string) => {
  return useQuery({
    queryKey: ["profile-saved-tracks", profileUserId],
    queryFn: async () => {
      if (!profileUserId) return [];
      const { data, error } = await supabase
        .from("music_saves")
        .select("*, track:exclusive_tracks(*)")
        .eq("user_id", profileUserId)
        .eq("added_to_profile", true)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const saves = (data || []) as unknown as SavedTrackWithMeta[];
      // Hydrate artist info per unique artist_user_id
      const artistIds = Array.from(
        new Set(saves.map((s) => s.track?.artist_user_id).filter(Boolean))
      ) as string[];
      if (artistIds.length === 0) return saves;
      const { data: artists } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", artistIds);
      const map = new Map(
        (artists || []).map((a) => [a.user_id, { display_name: a.display_name, avatar_url: a.avatar_url }])
      );
      return saves.map((s) => ({
        ...s,
        track: { ...s.track, artist: map.get(s.track.artist_user_id) || null },
      }));
    },
    enabled: !!profileUserId,
  });
};

export const useMusicLibraryMutations = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const saveTrack = useMutation({
    mutationFn: async ({ trackId, addToProfile = false }: { trackId: string; addToProfile?: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("music_saves").upsert(
        {
          user_id: user.id,
          track_id: trackId,
          added_to_profile: addToProfile,
        },
        { onConflict: "user_id,track_id" }
      );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["my-music-saves", user?.id] });
      qc.invalidateQueries({ queryKey: ["profile-saved-tracks", user?.id] });
      toast.success(vars.addToProfile ? "Added to your profile" : "Saved to library");
    },
    onError: () => toast.error("Failed to save track"),
  });

  const unsaveTrack = useMutation({
    mutationFn: async (trackId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("music_saves")
        .delete()
        .eq("user_id", user.id)
        .eq("track_id", trackId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-music-saves", user?.id] });
      qc.invalidateQueries({ queryKey: ["profile-saved-tracks", user?.id] });
      toast.success("Removed from library");
    },
    onError: () => toast.error("Failed to remove"),
  });

  const toggleAddToProfile = useMutation({
    mutationFn: async ({ trackId, addToProfile }: { trackId: string; addToProfile: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("music_saves").upsert(
        {
          user_id: user.id,
          track_id: trackId,
          added_to_profile: addToProfile,
        },
        { onConflict: "user_id,track_id" }
      );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["my-music-saves", user?.id] });
      qc.invalidateQueries({ queryKey: ["profile-saved-tracks", user?.id] });
      toast.success(vars.addToProfile ? "Now showing on your profile" : "Hidden from your profile");
    },
    onError: () => toast.error("Failed to update"),
  });

  return { saveTrack, unsaveTrack, toggleAddToProfile };
};

/** Helper: trigger a browser download for an audio URL. */
export const downloadTrack = async (url: string, filename: string) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (e) {
    console.error("Download failed", e);
    toast.error("Download failed");
  }
};
