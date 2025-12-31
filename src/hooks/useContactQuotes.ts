import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ContactQuote {
  id: string;
  pipeline_item_id: string;
  owner_user_id: string;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export function useContactQuotes(pipelineItemId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['contact-quotes', pipelineItemId],
    queryFn: async () => {
      if (!pipelineItemId) return [];
      const { data, error } = await supabase
        .from('contact_quotes')
        .select('*')
        .eq('pipeline_item_id', pipelineItemId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ContactQuote[];
    },
    enabled: !!user && !!pipelineItemId,
  });

  const createQuote = useMutation({
    mutationFn: async (quote: { title: string; description?: string; amount: number; currency?: string; valid_until?: string }) => {
      if (!user || !pipelineItemId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('contact_quotes')
        .insert({
          pipeline_item_id: pipelineItemId,
          owner_user_id: user.id,
          title: quote.title,
          description: quote.description || null,
          amount: quote.amount,
          currency: quote.currency || 'USD',
          valid_until: quote.valid_until || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-quotes', pipelineItemId] });
    },
  });

  const updateQuote = useMutation({
    mutationFn: async ({ quoteId, updates }: { quoteId: string; updates: Partial<ContactQuote> }) => {
      const { error } = await supabase
        .from('contact_quotes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', quoteId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-quotes', pipelineItemId] });
    },
  });

  const deleteQuote = useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase
        .from('contact_quotes')
        .delete()
        .eq('id', quoteId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-quotes', pipelineItemId] });
    },
  });

  return {
    quotes,
    isLoading,
    createQuote: createQuote.mutateAsync,
    updateQuote: updateQuote.mutateAsync,
    deleteQuote: deleteQuote.mutateAsync,
    isCreating: createQuote.isPending,
  };
}
