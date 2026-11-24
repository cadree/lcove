import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";
import { LOCKED_MUSIC_BUCKET, isFreeMusicTrack, summarizeSales, type TrackSales } from "@/lib/lockedMusic";

function jsonRecord(value: Json | null): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

export interface ExclusiveTrack {
  id: string;
  artist_user_id: string;
  title: string;
  cover_image_url?: string | null;
  audio_file_url?: string | null;
  /** Full file in the private music bucket ("<artist id>/<file>"). */
  audio_file_path?: string | null;
  preview_clip_url?: string | null;
  duration_seconds?: number | null;
  access_type: string;
  price_cents: number;
  description?: string | null;
  is_published: boolean;
  allow_downloads?: boolean;
  visible_on_profile?: boolean;
  preview_start_seconds?: number;
  preview_duration_seconds?: number;
  created_at: string;
  updated_at: string;
}

export interface ExclusiveAccessRule {
  id: string;
  artist_user_id: string;
  track_id?: string | null;
  rule_type: string;
  label?: string | null;
  description?: string | null;
  amount_cents: number;
  interval?: string | null;
  metadata: Record<string, Json | undefined>;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExclusiveTrackPurchase {
  id: string;
  track_id: string;
  buyer_user_id: string;
  access_rule_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_session_id?: string | null;
  payment_status?: string;
  amount_cents: number;
  created_at: string;
}

export interface ArtistSubscription {
  id: string;
  artist_user_id: string;
  subscriber_user_id: string;
  status: string;
  current_period_end?: string | null;
  amount_cents: number;
  interval: string;
  created_at: string;
}

export const useExclusiveTracks = (artistUserId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOwner = user?.id === artistUserId;

  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["exclusive-tracks", artistUserId],
    queryFn: async () => {
      if (!artistUserId) return [];
      const { data, error } = await supabase
        .from("exclusive_tracks")
        .select("*")
        .eq("artist_user_id", artistUserId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ExclusiveTrack[];
    },
    enabled: !!artistUserId,
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["exclusive-purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("exclusive_track_purchases")
        .select("*")
        .eq("buyer_user_id", user.id)
        .eq("payment_status", "paid");
      if (error) throw error;
      return (data || []) as ExclusiveTrackPurchase[];
    },
    enabled: !!user?.id,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["artist-subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("artist_subscriptions")
        .select("*")
        .eq("subscriber_user_id", user.id)
        .eq("status", "active");
      if (error) throw error;
      return (data || []) as ArtistSubscription[];
    },
    enabled: !!user?.id,
  });

  const isSubscribedToArtist = !!artistUserId && subscriptions.some((s) => s.artist_user_id === artistUserId && (!s.current_period_end || Date.parse(s.current_period_end) > Date.now()));

  const hasAccess = (trackId: string): boolean => {
    if (isOwner) return true;
    const track = tracks.find((t) => t.id === trackId);
    if (track && isFreeMusicTrack(track)) return true;
    if (purchases.some((p) => p.track_id === trackId)) return true;
    if (isSubscribedToArtist) return true;
    return false;
  };

  const createTrack = useMutation({
    mutationFn: async (track: Partial<ExclusiveTrack>) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("exclusive_tracks").insert({
        artist_user_id: user.id,
        title: track.title || "Untitled",
        cover_image_url: track.cover_image_url,
        audio_file_path: track.audio_file_path,
        preview_clip_url: track.preview_clip_url,
        duration_seconds: track.duration_seconds,
        access_type: track.access_type || "purchase",
        price_cents: track.price_cents || 0,
        description: track.description,
        is_published: track.is_published ?? false,
        allow_downloads: track.allow_downloads ?? false,
        preview_start_seconds: track.preview_start_seconds ?? 0,
        preview_duration_seconds: track.preview_duration_seconds ?? 15,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exclusive-tracks", user?.id] });
      toast.success("Track added!");
    },
    // The upload form shows the error with its own message.
  });

  const updateTrack = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ExclusiveTrack> & { id: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("exclusive_tracks")
        .update(updates)
        .eq("id", id)
        .eq("artist_user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exclusive-tracks", user?.id] });
      toast.success("Track updated!");
    },
    onError: () => toast.error("Failed to update track"),
  });

  const deleteTrack = useMutation({
    mutationFn: async (trackId: string) => {
      if (!user) throw new Error("Not authenticated");
      const track = tracks.find((t) => t.id === trackId);
      const { error } = await supabase
        .from("exclusive_tracks")
        .delete()
        .eq("id", trackId)
        .eq("artist_user_id", user.id);
      if (error) throw error;
      // Best effort: the row is gone, so nobody can reach the file through it anyway.
      if (track?.audio_file_path) {
        await supabase.storage.from(LOCKED_MUSIC_BUCKET).remove([track.audio_file_path]).catch(() => undefined);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exclusive-tracks", user?.id] });
      toast.success("Track deleted");
    },
    onError: () => toast.error("Failed to delete track"),
  });

  return {
    tracks: isOwner ? tracks : tracks.filter((t) => t.is_published),
    isLoading,
    purchases,
    subscriptions,
    isSubscribedToArtist,
    hasAccess,
    createTrack,
    updateTrack,
    deleteTrack,
    isOwner,
  };
};

export const useAccessRules = (artistUserId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["access-rules", artistUserId],
    queryFn: async () => {
      if (!artistUserId) return [];
      const { data, error } = await supabase
        .from("exclusive_access_rules")
        .select("*")
        .eq("artist_user_id", artistUserId)
        .order("sort_order");
      if (error) throw error;
      return (data || []).map((r) => ({
        ...r,
        metadata: jsonRecord(r.metadata),
      }));
    },
    enabled: !!artistUserId,
  });

  const createRule = useMutation({
    mutationFn: async (rule: Partial<ExclusiveAccessRule>) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("exclusive_access_rules").insert({
        artist_user_id: user.id,
        track_id: rule.track_id || null,
        rule_type: rule.rule_type || "purchase",
        label: rule.label,
        description: rule.description,
        amount_cents: rule.amount_cents || 0,
        interval: rule.interval,
        metadata: (rule.metadata || {}) as Json,
        sort_order: rule.sort_order || 0,
        is_active: rule.is_active ?? true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-rules", user?.id] });
      toast.success("Access rule created!");
    },
    onError: () => toast.error("Failed to create rule"),
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ExclusiveAccessRule> & { id: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { metadata, ...rest } = updates;
      const toUpdate: TablesUpdate<"exclusive_access_rules"> = { ...rest };
      if (metadata) toUpdate.metadata = metadata as unknown as Json;
      const { error } = await supabase
        .from("exclusive_access_rules")
        .update(toUpdate)
        .eq("id", id)
        .eq("artist_user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-rules", user?.id] });
    },
    onError: () => toast.error("Failed to update rule"),
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("exclusive_access_rules")
        .delete()
        .eq("id", ruleId)
        .eq("artist_user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-rules", user?.id] });
      toast.success("Rule removed");
    },
    onError: () => toast.error("Failed to remove rule"),
  });

  return { rules, isLoading, createRule, updateRule, deleteRule };
};

/**
 * Short-lived URL for the full private file. The storage API signs it only when
 * the caller passes the bucket's read policy (artist, paid buyer, or subscriber),
 * so this works the same on every device the buyer signs in on.
 */
export const usePrivateTrackUrl = (track: Pick<ExclusiveTrack, "id" | "audio_file_path">, enabled: boolean) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["private-track-url", track.id, track.audio_file_path, user?.id],
    queryFn: async () => {
      if (!track.audio_file_path) return null;
      const { data, error } = await supabase.storage
        .from(LOCKED_MUSIC_BUCKET)
        .createSignedUrl(track.audio_file_path, 60 * 60);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
    enabled: enabled && !!user && !!track.audio_file_path,
    staleTime: 50 * 60 * 1000,
    retry: 1,
  });
};

/** Sales per track for the artist (RLS shows an artist only purchases of their own tracks). */
export const useTrackSales = (artistUserId: string | undefined, enabled: boolean) => {
  return useQuery({
    queryKey: ["exclusive-track-sales", artistUserId],
    queryFn: async (): Promise<Record<string, TrackSales>> => {
      const { data: own, error: tracksError } = await supabase
        .from("exclusive_tracks")
        .select("id")
        .eq("artist_user_id", artistUserId as string);
      if (tracksError) throw tracksError;
      const ids = (own || []).map((t) => t.id);
      if (ids.length === 0) return {};
      const { data, error } = await supabase
        .from("exclusive_track_purchases")
        .select("track_id, amount_cents, payment_status")
        .in("track_id", ids);
      if (error) throw error;
      return summarizeSales(data || []);
    },
    enabled: enabled && !!artistUserId,
  });
};
