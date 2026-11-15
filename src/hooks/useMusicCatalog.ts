import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { orderSections, positionsFor, type MusicPlacementRow, type MusicSectionRow } from "@/lib/musicCatalog";

export interface MusicSection extends MusicSectionRow {
  user_id: string;
}

export interface MusicPlacement extends MusicPlacementRow {
  id: string;
  exclusive_track_id: string | null;
}

const fail = (action: string) => (error: unknown) => {
  console.error(error);
  const detail = error instanceof Error && error.message ? `: ${error.message}` : "";
  toast.error(`Couldn't ${action}${detail}`);
};

/** The owner's catalog layout: named sections and which item sits where. */
export function useMusicCatalog(userId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOwner = !!user && user.id === userId;
  const key = ["music-catalog", userId] as const;

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!userId) return { sections: [] as MusicSection[], placements: [] as MusicPlacement[] };
      const [sections, placements] = await Promise.all([
        supabase.from("music_sections").select("id,user_id,title,cover_url,position,created_at").eq("user_id", userId),
        supabase.from("music_section_items").select("id,section_id,item_key,exclusive_track_id,position").eq("user_id", userId),
      ]);
      if (sections.error) throw sections.error;
      if (placements.error) throw placements.error;
      return {
        sections: orderSections((sections.data || []) as MusicSection[]),
        placements: (placements.data || []) as MusicPlacement[],
      };
    },
    enabled: !!userId,
  });

  const sections = data?.sections ?? [];
  const placements = data?.placements ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const requireOwner = () => {
    if (!user || !isOwner) throw new Error("Only the artist can change this");
    return user.id;
  };

  const createSection = useMutation({
    mutationFn: async (title: string) => {
      const owner = requireOwner();
      const position = sections.length ? Math.max(...sections.map((s) => s.position)) + 1 : 0;
      const { error } = await supabase.from("music_sections").insert({ user_id: owner, title, position });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: fail("add the section"),
  });

  const updateSection = useMutation({
    mutationFn: async ({ id, ...changes }: { id: string; title?: string; cover_url?: string | null }) => {
      const owner = requireOwner();
      const { error } = await supabase.from("music_sections").update(changes).eq("id", id).eq("user_id", owner);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: fail("update the section"),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const owner = requireOwner();
      const { error } = await supabase.from("music_sections").delete().eq("id", id).eq("user_id", owner);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: fail("delete the section"),
  });

  const reorderSections = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const owner = requireOwner();
      for (const { id, position } of positionsFor(orderedIds)) {
        const { error } = await supabase.from("music_sections").update({ position }).eq("id", id).eq("user_id", owner);
        if (error) throw error;
      }
    },
    onSuccess: refresh,
    onError: fail("reorder your sections"),
  });

  /** Put an item in a section (at the end), or take it out with sectionId null. */
  const placeItem = useMutation({
    mutationFn: async ({ itemKey, sectionId, trackId }: { itemKey: string; sectionId: string | null; trackId?: string }) => {
      const owner = requireOwner();
      if (!sectionId) {
        const { error } = await supabase.from("music_section_items").delete().eq("user_id", owner).eq("item_key", itemKey);
        if (error) throw error;
        return;
      }
      const inSection = placements.filter((p) => p.section_id === sectionId && p.item_key !== itemKey);
      const position = inSection.length ? Math.max(...inSection.map((p) => p.position)) + 1 : 0;
      const { error } = await supabase.from("music_section_items").upsert(
        { user_id: owner, section_id: sectionId, item_key: itemKey, exclusive_track_id: trackId ?? null, position },
        { onConflict: "user_id,item_key" },
      );
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: fail("move that"),
  });

  const reorderItems = useMutation({
    mutationFn: async (orderedKeys: string[]) => {
      const owner = requireOwner();
      for (const { id: itemKey, position } of positionsFor(orderedKeys)) {
        const { error } = await supabase
          .from("music_section_items")
          .update({ position })
          .eq("user_id", owner)
          .eq("item_key", itemKey);
        if (error) throw error;
      }
    },
    onSuccess: refresh,
    onError: fail("reorder that section"),
  });

  const busy =
    createSection.isPending ||
    updateSection.isPending ||
    deleteSection.isPending ||
    reorderSections.isPending ||
    placeItem.isPending ||
    reorderItems.isPending;

  return {
    sections,
    placements,
    isLoading,
    isOwner,
    busy,
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
    placeItem,
    reorderItems,
  };
}
