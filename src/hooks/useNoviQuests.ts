import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { callRpc } from "@/lib/rpc";
import { questViews, streakFromDays, xpBar, type QuestView } from "@/lib/noviQuests";
import { shotSessionEnabled } from "@/lib/shotSession";

export interface NoviBoard {
  total: number;
  level: number;
  streakDays: string[];
  bookOpened: boolean;
  dailyDone: boolean;
  postCount: number;
  connectionCount: number;
  completedProjects: number;
  profileReady: boolean;
}

const emptyBoard: NoviBoard = {
  total: 0,
  level: 1,
  streakDays: [],
  bookOpened: false,
  dailyDone: false,
  postCount: 0,
  connectionCount: 0,
  completedProjects: 0,
  profileReady: false,
};

function shotBoard(): NoviBoard {
  return {
    ...emptyBoard,
    postCount: 1,
    connectionCount: 2,
    profileReady: true,
  };
}

export function useNoviQuests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const boardQuery = useQuery({
    queryKey: ["novi-board", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (shotSessionEnabled()) return shotBoard();
      try {
        const data = await callRpc<NoviBoard>("novi_board");
        return { ...emptyBoard, ...data, streakDays: data?.streakDays ?? [] };
      } catch {
        return emptyBoard;
      }
    },
  });

  const board = boardQuery.data ?? emptyBoard;
  const quests: QuestView[] = questViews({
    profileReady: board.profileReady,
    postCount: board.postCount,
    connectionCount: board.connectionCount,
    bookOpened: board.bookOpened,
    completedProjects: board.completedProjects,
  });
  const today = new Date().toISOString().slice(0, 10);
  const filed = useRef(new Set<string>());

  const complete = useMutation({
    mutationFn: async (questId: string) => {
      if (shotSessionEnabled()) return shotBoard();
      return callRpc<NoviBoard>("complete_novi_quest", { p_quest: questId });
    },
    onSuccess: (data) => {
      if (data) queryClient.setQueryData(["novi-board", user?.id], { ...emptyBoard, ...data, streakDays: data.streakDays ?? [] });
      queryClient.invalidateQueries({ queryKey: ["my-xp", user?.id] });
    },
  });

  useEffect(() => {
    if (!user || shotSessionEnabled() || !boardQuery.isSuccess) return;
    for (const quest of quests) {
      if (quest.xp > 0 && quest.state === "decrypted" && !filed.current.has(quest.id)) {
        filed.current.add(quest.id);
        complete.mutate(quest.id);
      }
    }
  }, [boardQuery.dataUpdatedAt, complete, quests, user]);

  return {
    quests,
    total: board.total,
    bar: xpBar(board.total),
    streak: streakFromDays(board.streakDays, today),
    dailyDone: board.dailyDone,
    isLoading: boardQuery.isLoading,
    complete,
  };
}
