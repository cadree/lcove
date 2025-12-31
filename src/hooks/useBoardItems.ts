import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export type BoardItemType = 'note' | 'link' | 'todo' | 'image' | 'line' | 'column' | 'board_ref';

export interface BoardItem {
  id: string;
  board_id: string;
  type: BoardItemType;
  title: string | null;
  content: Json;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z_index: number;
  parent_item_id: string | null;
  is_trashed: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useBoardItems = (boardId: string | undefined) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["board-items", boardId],
    queryFn: async () => {
      if (!boardId) return [];
      
      const { data, error } = await supabase
        .from("board_items")
        .select("*")
        .eq("board_id", boardId)
        .eq("is_trashed", false)
        .order("z_index", { ascending: true });

      if (error) throw error;
      return data as BoardItem[];
    },
    enabled: !!user && !!boardId,
  });

  const createItem = useMutation({
    mutationFn: async (item: Omit<BoardItem, 'id' | 'created_at' | 'updated_at' | 'is_trashed'>) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("board_items")
        .insert({
          ...item,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BoardItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-items", boardId] });
    },
    onError: () => {
      toast.error("Failed to create item");
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BoardItem> & { id: string }) => {
      const { error } = await supabase
        .from("board_items")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-items", boardId] });
    },
    onError: () => {
      toast.error("Failed to update item");
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("board_items")
        .update({ is_trashed: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-items", boardId] });
    },
    onError: () => {
      toast.error("Failed to delete item");
    },
  });

  // Batch update for drag operations
  const batchUpdatePositions = useMutation({
    mutationFn: async (updates: { id: string; x: number; y: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from("board_items")
          .update({ x: update.x, y: update.y })
          .eq("id", update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-items", boardId] });
    },
  });

  return {
    items,
    isLoading,
    createItem,
    updateItem,
    deleteItem,
    batchUpdatePositions,
  };
};
