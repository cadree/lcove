import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Board {
  id: string;
  owner_user_id: string;
  title: string;
  description: string | null;
  is_trashed: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardMember {
  board_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  created_at: string;
}

export const useBoards = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["boards", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("boards")
        .select("*")
        .eq("is_trashed", false)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as Board[];
    },
    enabled: !!user,
  });

  const createBoard = useMutation({
    mutationFn: async ({ title, description }: { title: string; description?: string }) => {
      if (!user) throw new Error("Not authenticated");

      // Create the board
      const { data: board, error: boardError } = await supabase
        .from("boards")
        .insert({
          owner_user_id: user.id,
          title,
          description: description || null,
        })
        .select()
        .single();

      if (boardError) throw boardError;

      // Add the creator as owner in board_members
      const { error: memberError } = await supabase
        .from("board_members")
        .insert({
          board_id: board.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      return board as Board;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      toast.success("Board created!");
    },
    onError: (error) => {
      console.error("Failed to create board:", error);
      toast.error("Failed to create board");
    },
  });

  const updateBoard = useMutation({
    mutationFn: async ({ id, title, description }: { id: string; title?: string; description?: string }) => {
      const updates: Partial<Board> = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;

      const { error } = await supabase
        .from("boards")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    },
    onError: () => {
      toast.error("Failed to update board");
    },
  });

  const deleteBoard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("boards")
        .update({ is_trashed: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      toast.success("Board moved to trash");
    },
    onError: () => {
      toast.error("Failed to delete board");
    },
  });

  return {
    boards,
    isLoading,
    createBoard,
    updateBoard,
    deleteBoard,
  };
};

export const useBoard = (boardId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      if (!boardId) return null;
      
      const { data, error } = await supabase
        .from("boards")
        .select("*")
        .eq("id", boardId)
        .maybeSingle();

      if (error) throw error;
      return data as Board | null;
    },
    enabled: !!user && !!boardId,
  });
};
