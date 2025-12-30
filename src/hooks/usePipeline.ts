import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  ensureMyDefaultPipeline,
  getMyPipeline,
  createPipelineItem,
  updatePipelineItem,
  movePipelineItem,
  deletePipelineItem,
  addPipelineNoteEvent,
  getPipelineItemEvents,
  PipelineData,
  PipelineItem,
  PipelineEvent,
  CreatePipelineItemData
} from "@/actions/pipelineActions";

export function usePipeline() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Initialize default pipeline and fetch data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pipeline', user?.id],
    queryFn: async () => {
      await ensureMyDefaultPipeline();
      return getMyPipeline();
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const createItemMutation = useMutation({
    mutationFn: (data: CreatePipelineItemData) => createPipelineItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', user?.id] });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, fields }: { itemId: string; fields: { title?: string; subtitle?: string; notes?: string } }) =>
      updatePipelineItem(itemId, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', user?.id] });
    },
  });

  const moveItemMutation = useMutation({
    mutationFn: ({ itemId, toStageId, newSortOrder }: { itemId: string; toStageId: string; newSortOrder: number }) =>
      movePipelineItem(itemId, toStageId, newSortOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', user?.id] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => deletePipelineItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', user?.id] });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: ({ itemId, noteText }: { itemId: string; noteText: string }) =>
      addPipelineNoteEvent(itemId, noteText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', user?.id] });
    },
  });

  // Helper to get items grouped by stage
  const getItemsByStage = (stageId: string): PipelineItem[] => {
    if (!data?.items) return [];
    return data.items
      .filter(item => item.stage_id === stageId)
      .sort((a, b) => a.sort_order - b.sort_order);
  };

  // Helper to get events for a specific item
  const getEventsForItem = (itemId: string): PipelineEvent[] => {
    if (!data?.events) return [];
    return data.events
      .filter(event => event.item_id === itemId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  return {
    stages: data?.stages || [],
    items: data?.items || [],
    events: data?.events || [],
    isLoading,
    error,
    refetch,
    getItemsByStage,
    getEventsForItem,
    createItem: createItemMutation.mutateAsync,
    updateItem: updateItemMutation.mutateAsync,
    moveItem: moveItemMutation.mutateAsync,
    deleteItem: deleteItemMutation.mutateAsync,
    addNote: addNoteMutation.mutateAsync,
    isCreating: createItemMutation.isPending,
    isUpdating: updateItemMutation.isPending,
    isMoving: moveItemMutation.isPending,
    isDeleting: deleteItemMutation.isPending,
  };
}

export function usePipelineItemEvents(itemId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pipeline-events', itemId],
    queryFn: () => getPipelineItemEvents(itemId!),
    enabled: !!user && !!itemId,
  });
}
