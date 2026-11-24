import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queueMedia } from "@/lib/queuedMedia";
import { insertPostRow } from "@/lib/postRows";
import { autoCover } from "@/lib/videoCover";
import { assertCleanText } from "@/lib/objectionableText";
import { refreshXp } from "@/lib/xpRefresh";

export interface PostDraft {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: "photo" | "video" | "text";
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

interface SaveDraft {
  id?: string | null;
  content: string;
  file?: File | null;
  cover?: File | null;
  mediaType: "photo" | "video" | "text";
}

const KEY = ["post-drafts"];

/** Private drafts. Only the owner can read them (post_drafts RLS); they are never posts until published. */
export function usePostDrafts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const drafts = useQuery({
    queryKey: [...KEY, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_drafts")
        .select("id, user_id, content, media_url, media_type, thumbnail_url, created_at, updated_at")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(50);
      // Before the drafts migration runs there is simply nothing to list.
      if (error) return [] as PostDraft[];
      return (data ?? []) as PostDraft[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

  const save = useMutation({
    mutationFn: async ({ id, content, file, cover, mediaType }: SaveDraft) => {
      if (!user) throw new Error("Must be logged in");
      const text = content.trim() || null;
      if (id) {
        const { error } = await supabase.from("post_drafts").update({ content: text }).eq("id", id);
        if (error) throw error;
        return;
      }
      if (file && mediaType !== "text") {
        const coverFile = mediaType === "video" ? cover ?? await autoCover(file, 4000) : null;
        queueMedia({
          queryClient,
          userId: user.id,
          kind: "post",
          label: "Draft",
          files: coverFile ? [file, coverFile] : [file],
          mediaType,
          content: text,
          placeholder: false,
          insert: async ([mediaUrl, coverUrl]) => {
            const { error } = await supabase.from("post_drafts").insert({
              user_id: user.id,
              content: text,
              media_url: mediaUrl,
              media_type: mediaType,
              thumbnail_url: coverUrl ?? null,
            });
            if (error) throw error;
          },
          invalidate: [KEY],
          successMessage: "Draft saved",
        });
        return;
      }
      const { error } = await supabase.from("post_drafts").insert({ user_id: user.id, content: text, media_type: "text" });
      if (error) throw error;
    },
    onSuccess: (_, input) => {
      void refresh();
      if (!input.file || input.id) toast.success("Draft saved");
    },
    onError: () => toast.error("Couldn't save the draft"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("post_drafts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { void refresh(); toast.success("Draft deleted"); },
    onError: () => toast.error("Couldn't delete the draft"),
  });

  const publish = useMutation({
    mutationFn: async ({ draft, content }: { draft: PostDraft; content?: string | null }) => {
      if (!user) throw new Error("Must be logged in");
      const text = (content ?? draft.content)?.trim() || null;
      assertCleanText(text ?? undefined);
      const { error } = await insertPostRow({
        user_id: user.id,
        content: text,
        media_url: draft.media_url,
        media_type: draft.media_type,
        ...(draft.thumbnail_url ? { thumbnail_url: draft.thumbnail_url } : {}),
      });
      if (error) throw error;
      await supabase.from("post_drafts").delete().eq("id", draft.id);
    },
    onSuccess: () => {
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
      void queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      refreshXp(queryClient);
      toast.success("Post shared");
    },
  });

  return { drafts: drafts.data ?? [], isLoading: drafts.isLoading, save, remove, publish };
}
