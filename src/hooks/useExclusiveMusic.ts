import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface ExclusiveTrack {
  id: string;
  artist_user_id: string;
  title: string;
  cover_image_url?: string | null;
  audio_file_url?: string | null;
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
  metadata: Record<string, any>;
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

  const isSubscribedToArtist = !!artistUserId && subscriptions.some((s) => s.artist_user_id === artistUserId);

  const hasAccess = (trackId: string): boolean => {
    if (isOwner) return true;
    if (purchases.some((p) => p.track_id === trackId)) return true;
    return isSubscribedToArtist;
  };

  const createTrack = useMutation({
    mutationFn: async (track: Partial<ExclusiveTrack>) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("exclusive_tracks").insert({
        artist_user_id: user.id,
        title: track.title || "Untitled",
        cover_image_url: track.cover_image_url,
        audio_file_url: track.audio_file_url,
        preview_clip_url: track.preview_clip_url,
        duration_seconds: track.duration_seconds,
        access_type: track.access_type || "purchase",
        price_cents: track.price_cents || 0,
        description: track.description,
        is_published: track.is_published ?? false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exclusive-tracks", user?.id] });
      toast.success("Track added!");
    },
    onError: () => toast.error("Failed to add track"),
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
      const { error } = await supabase
        .from("exclusive_tracks")
        .delete()
        .eq("id", trackId)
        .eq("artist_user_id", user.id);
      if (error) throw error;
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
        metadata: (r.metadata as Record<string, any>) || {},
      })) as ExclusiveAccessRule[];
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
      const toUpdate: Record<string, any> = { ...updates };
      if (updates.metadata) toUpdate.metadata = updates.metadata as Json;
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
