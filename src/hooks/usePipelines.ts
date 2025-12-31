import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Pipeline {
  id: string;
  owner_user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function usePipelines() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pipelines = [], isLoading, error } = useQuery({
    queryKey: ['pipelines', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('pipelines' as any)
        .select('*')
        .eq('owner_user_id', user.id)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return (data || []) as unknown as Pipeline[];
    },
    enabled: !!user,
  });

  const createPipelineMutation = useMutation({
    mutationFn: async ({ name, description, color }: { name: string; description?: string; color?: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data: existing } = await supabase
        .from('pipelines' as any)
        .select('sort_order')
        .eq('owner_user_id', user.id)
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const nextSortOrder = existing && existing.length > 0 ? (existing[0] as any).sort_order + 1 : 0;
      
      const { data, error } = await supabase
        .from('pipelines' as any)
        .insert({
          owner_user_id: user.id,
          name,
          description: description || null,
          color: color || null,
          sort_order: nextSortOrder
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Create default stages for new pipeline - pass both parameters explicitly
      await supabase.rpc('ensure_default_pipeline' as any, { 
        p_user_id: user.id,
        p_pipeline_id: (data as any).id 
      });
      
      return data as unknown as Pipeline;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });

  const updatePipelineMutation = useMutation({
    mutationFn: async ({ pipelineId, name, description, color }: { 
      pipelineId: string; 
      name?: string; 
      description?: string; 
      color?: string 
    }) => {
      if (!user) throw new Error("Not authenticated");
      
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (color !== undefined) updates.color = color;
      
      const { error } = await supabase
        .from('pipelines' as any)
        .update(updates)
        .eq('id', pipelineId)
        .eq('owner_user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', user?.id] });
    },
  });

  const deletePipelineMutation = useMutation({
    mutationFn: async (pipelineId: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from('pipelines' as any)
        .delete()
        .eq('id', pipelineId)
        .eq('owner_user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });

  return {
    pipelines,
    isLoading,
    error,
    createPipeline: createPipelineMutation.mutateAsync,
    updatePipeline: updatePipelineMutation.mutateAsync,
    deletePipeline: deletePipelineMutation.mutateAsync,
    isCreating: createPipelineMutation.isPending,
    isUpdating: updatePipelineMutation.isPending,
    isDeleting: deletePipelineMutation.isPending,
  };
}
