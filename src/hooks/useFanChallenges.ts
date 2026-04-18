import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ExclusiveAccessRule } from "@/hooks/useExclusiveMusic";

export interface FanChallengeCompletion {
  id: string;
  user_id: string;
  artist_user_id: string;
  track_id: string | null;
  access_rule_id: string;
  challenge_type: string;
  proof_url: string | null;
  proof_text: string | null;
  verified: boolean;
  status: "completed" | "flagged" | "revoked";
  completed_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
}

export interface ChallengeMeta {
  platform?: string;
  instructions?: string;
  requires_proof?: boolean;
}

export const getChallengeMeta = (rule: ExclusiveAccessRule): ChallengeMeta => {
  return (rule.metadata as ChallengeMeta) || {};
};

/** Most-specific active challenge rule for a track (track-level wins, else artist-wide). */
export const pickChallengeRule = (
  rules: ExclusiveAccessRule[],
  trackId: string
): ExclusiveAccessRule | null => {
  const active = rules.filter((r) => r.rule_type === "challenge" && r.is_active);
  return (
    active.find((r) => r.track_id === trackId) ||
    active.find((r) => r.track_id === null) ||
    null
  );
};

export const useMyChallengeCompletions = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fan-challenge-completions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("fan_challenge_completions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "completed");
      if (error) throw error;
      return (data || []) as FanChallengeCompletion[];
    },
    enabled: !!user?.id,
  });
};

export const useArtistChallengeCompletions = (artistUserId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fan-challenge-completions-artist", artistUserId],
    queryFn: async () => {
      if (!artistUserId || user?.id !== artistUserId) return [];
      const { data, error } = await supabase
        .from("fan_challenge_completions")
        .select("*")
        .eq("artist_user_id", artistUserId)
        .order("completed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as FanChallengeCompletion[];
    },
    enabled: !!artistUserId && user?.id === artistUserId,
  });
};

export const useChallengeUnlockCount = (trackId?: string | null) => {
  return useQuery({
    queryKey: ["challenge-unlock-count", trackId],
    queryFn: async () => {
      if (!trackId) return 0;
      const { data, error } = await supabase.rpc("get_challenge_unlock_count", {
        p_track_id: trackId,
      });
      if (error) throw error;
      return Number(data || 0);
    },
    enabled: !!trackId,
  });
};

export const useCompleteChallenge = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      rule: ExclusiveAccessRule;
      trackId: string | null;
      proofFile?: File | null;
      proofText?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { rule, trackId, proofFile, proofText } = params;
      const meta = getChallengeMeta(rule);

      let proofUrl: string | null = null;
      if (proofFile) {
        const ext = proofFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/challenge-proofs/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, proofFile, { upsert: true });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("media").getPublicUrl(path);
        proofUrl = data.publicUrl;
      }

      const { error } = await supabase.from("fan_challenge_completions").insert({
        user_id: user.id,
        artist_user_id: rule.artist_user_id,
        track_id: trackId,
        access_rule_id: rule.id,
        challenge_type: meta.platform || "other",
        proof_url: proofUrl,
        proof_text: proofText?.trim() || null,
        verified: !meta.requires_proof,
        status: "completed",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fan-challenge-completions"] });
      queryClient.invalidateQueries({ queryKey: ["challenge-unlock-count"] });
      toast.success("You unlocked this by supporting the artist 💖");
    },
    onError: (e: any) => {
      const msg = e?.message?.includes("duplicate")
        ? "You've already unlocked this challenge"
        : e?.message || "Could not record your completion";
      toast.error(msg);
    },
  });
};

export const useRevokeChallengeCompletion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fan_challenge_completions")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fan-challenge-completions-artist"] });
      queryClient.invalidateQueries({ queryKey: ["fan-challenge-completions"] });
      queryClient.invalidateQueries({ queryKey: ["challenge-unlock-count"] });
      toast.success("Access revoked");
    },
    onError: () => toast.error("Failed to revoke"),
  });
};
