import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { callRpc } from "@/lib/rpc";
import { autoFileQuestId, questViews, streakFromDays, type QuestView } from "@/lib/noviQuests";
import { shotSessionEnabled } from "@/lib/shotSession";

export interface NoviBoard {
  total: number;
  level: number;
  /** Consecutive days, same key signed in or out. */
  streak: number;
  streakDays: string[];
  dailyXp: number;
  bookOpened: boolean;
  dailyDone: boolean;
  postCount: number;
  connectionCount: number;
  completedProjects: number;
  profileReady: boolean;
  studioOpened: boolean;
}

const filedQuestKeys = new Set<string>();
const filedQuestPages = new Set<string>();

const emptyBoard: NoviBoard = {
  total: 0,
  level: 1,
  streak: 0,
  streakDays: [],
  dailyXp: 0,
  bookOpened: false,
  dailyDone: false,
  postCount: 0,
  connectionCount: 0,
  completedProjects: 0,
  profileReady: false,
  studioOpened: false,
};

function normalizeBoard(data: Partial<NoviBoard> | null | undefined): NoviBoard {
  const raw = data ?? {};
  const streakDays = Array.isArray(raw.streakDays) ? raw.streakDays : [];
  return {
    ...emptyBoard,
    ...raw,
    streak: Number(raw.streak ?? 0),
    streakDays,
    dailyXp: Number(raw.dailyXp ?? 0),
  };
}

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
        return normalizeBoard(data);
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
    studioOpened: board.studioOpened,
  });
  const today = new Date().toISOString().slice(0, 10);

  const complete = useMutation({
    mutationFn: async (questId: string) => {
      if (shotSessionEnabled()) return shotBoard();
      return callRpc<NoviBoard>("complete_novi_quest", { p_quest: questId });
    },
    onSuccess: (data) => {
      const previous = queryClient.getQueryData<NoviBoard>(["novi-board", user?.id]);
      const next = data ? normalizeBoard(data) : null;
      if (next) queryClient.setQueryData(["novi-board", user?.id], next);
      queryClient.invalidateQueries({ queryKey: ["my-xp", user?.id] });
      const gained = next && previous ? next.total - previous.total : 0;
      if (gained > 0) {
        toast.success(`+${gained} XP`);
        window.dispatchEvent(new CustomEvent("ether-novi-xp", { detail: { gained, total: next?.total ?? 0 } }));
      }
    },
  });

  const completeQuest = useRef(complete.mutate);
  completeQuest.current = complete.mutate;

  useEffect(() => {
    if (!user || shotSessionEnabled() || !boardQuery.isSuccess || !boardQuery.data) return;
    const pageKey = `${user.id}:${window.location.pathname}`;
    if (filedQuestPages.has(pageKey)) return;
    const board = boardQuery.data;
    const views = questViews({
      profileReady: board.profileReady,
      postCount: board.postCount,
      connectionCount: board.connectionCount,
      bookOpened: board.bookOpened,
      completedProjects: board.completedProjects,
      studioOpened: board.studioOpened,
    });
    const filedIds = new Set(
      [...filedQuestKeys]
        .filter((key) => key.startsWith(`${user.id}:`))
        .map((key) => key.slice(user.id.length + 1)),
    );
    const questId = autoFileQuestId(views, filedIds);
    if (!questId) return;
    filedQuestPages.add(pageKey);
    filedQuestKeys.add(`${user.id}:${questId}`);
    completeQuest.current(questId);
  }, [boardQuery.data, boardQuery.dataUpdatedAt, boardQuery.isSuccess, user]);

  return {
    quests,
    total: board.total,
    streak: board.streakDays.length > 0 ? streakFromDays(board.streakDays, today) : board.streak,
    dailyXp: board.dailyXp,
    dailyDone: board.dailyDone,
    signals: {
      profileReady: board.profileReady,
      postCount: board.postCount,
      connectionCount: board.connectionCount,
      bookOpened: board.bookOpened,
      completedProjects: board.completedProjects,
      studioOpened: board.studioOpened,
    },
    isLoading: boardQuery.isLoading,
    isReady: boardQuery.isFetched,
    complete,
  };
}
