import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mediaPath } from "@/lib/backgroundUploads";
import { autoCover } from "@/lib/videoCover";

const tried = new Set<string>();
let running = Promise.resolve();

/**
 * Videos posted before covers existed: when the owner sees one on their own
 * grid, read a frame near 1s, store it, and save it as the cover. One at a
 * time, once per session, silent on failure (the tile keeps its frame fallback).
 */
export function useCoverBackfill(post: { id: string; user_id?: string; media_url: string | null; media_type: string | null; thumbnail_url?: string | null }, ownerId: string | undefined) {
  const queryClient = useQueryClient();
  const [cover, setCover] = useState<string | null>(null);
  const eligible = Boolean(ownerId && post.user_id === ownerId && post.media_type === "video" && post.media_url && !post.thumbnail_url);

  useEffect(() => {
    if (!eligible || !ownerId || tried.has(post.id)) return;
    tried.add(post.id);
    let cancelled = false;
    running = running.then(async () => {
      const frame = await autoCover(post.media_url as string, 8000);
      if (!frame || cancelled) return;
      const path = mediaPath(ownerId, frame);
      const { error: uploadError } = await supabase.storage.from("media").upload(path, frame, { contentType: "image/jpeg" });
      if (uploadError) return;
      const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from("posts").update({ thumbnail_url: url }).eq("id", post.id).eq("user_id", ownerId);
      if (error) return;
      if (!cancelled) setCover(url);
      void queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [eligible, ownerId, post.id, post.media_url, queryClient]);

  return cover;
}
