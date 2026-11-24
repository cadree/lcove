import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { asLook, safeCoverOverrides, type MusicLook } from "@/lib/musicView";

export interface MusicPagePrefs {
  look: MusicLook;
  featuredKey: string | null;
  looseOrder: string[];
  coverOverrides: Record<string, string>;
}

const EMPTY: MusicPagePrefs = { look: "ether", featuredKey: null, looseOrder: [], coverOverrides: {} };

/** The owner's look, featured item, loose order and release covers. Visitors read; only the owner saves. */
export function useMusicPagePrefs(userId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ["music-page-prefs", userId] as const;
  const isOwner = !!user && user.id === userId;

  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async (): Promise<MusicPagePrefs> => {
      const { data, error } = await supabase
        .from("music_page_prefs")
        .select("look, featured_key, loose_order, cover_overrides")
        .eq("user_id", userId!)
        .maybeSingle();
      // Before the table exists (an older database), the page just uses the defaults.
      if (error) return EMPTY;
      if (!data) return EMPTY;
      return {
        look: asLook(data.look),
        featuredKey: data.featured_key ?? null,
        looseOrder: data.loose_order ?? [],
        coverOverrides: safeCoverOverrides(data.cover_overrides),
      };
    },
  });

  const prefs = query.data ?? EMPTY;
  const save = useMutation({
    mutationFn: async (changes: Partial<MusicPagePrefs>) => {
      if (!user || !isOwner) throw new Error("Only the artist can change this");
      const next = { ...prefs, ...changes };
      const { error } = await supabase.from("music_page_prefs").upsert(
        {
          user_id: user.id,
          look: next.look,
          featured_key: next.featuredKey,
          loose_order: next.looseOrder.slice(0, 500),
          cover_overrides: next.coverOverrides,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      return next;
    },
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MusicPagePrefs>(key);
      queryClient.setQueryData<MusicPagePrefs>(key, { ...(previous ?? EMPTY), ...changes });
      return { previous };
    },
    onError: (error: Error, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(`Couldn't save that: ${error.message}`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { prefs, isLoading: query.isLoading, isOwner, save };
}
