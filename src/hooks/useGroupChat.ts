import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface GroupExpense {
  id: string;
  conversation_id: string;
  title: string;
  description: string | null;
  total_amount: number;
  currency: string;
  created_by: string;
  created_at: string;
  contributions?: ExpenseContribution[];
}

export interface ExpenseContribution {
  id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
  amount_paid: number;
  status: string;
  paid_at: string | null;
}

export interface GroupItinerary {
  id: string;
  conversation_id: string;
  title: string;
  start_date: string;
  end_date: string;
  created_by: string;
  items?: ItineraryItem[];
}

export interface ItineraryItem {
  id: string;
  itinerary_id: string;
  day_number: number;
  start_time: string | null;
  end_time: string | null;
  title: string;
  description: string | null;
  location: string | null;
}

export function useGroupExpenses(conversationId: string) {
  return useQuery({
    queryKey: ['group-expenses', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_expenses')
        .select(`
          *,
          contributions:group_expense_contributions(*)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as GroupExpense[];
    },
    enabled: !!conversationId,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      conversation_id: string;
      title: string;
      description?: string;
      total_amount: number;
      member_ids: string[];
    }) => {
      const perPerson = data.total_amount / data.member_ids.length;

      const { data: expense, error } = await supabase
        .from('group_expenses')
        .insert({
          conversation_id: data.conversation_id,
          title: data.title,
          description: data.description,
          total_amount: data.total_amount,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create contributions for each member
      const contributions = data.member_ids.map(userId => ({
        expense_id: expense.id,
        user_id: userId,
        amount_owed: perPerson,
      }));

      const { error: contribError } = await supabase
        .from('group_expense_contributions')
        .insert(contributions);

      if (contribError) throw contribError;

      return expense;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group-expenses', variables.conversation_id] });
      toast.success('Expense added');
    },
    onError: () => {
      toast.error('Failed to add expense');
    },
  });
}

export function useUpdateContribution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; amount_paid: number; conversationId: string }) => {
      const { error } = await supabase
        .from('group_expense_contributions')
        .update({
          amount_paid: data.amount_paid,
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group-expenses', variables.conversationId] });
      toast.success('Payment recorded');
    },
  });
}

export function useGroupItinerary(conversationId: string) {
  return useQuery({
    queryKey: ['group-itinerary', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_itineraries')
        .select(`
          *,
          items:itinerary_items(*)
        `)
        .eq('conversation_id', conversationId)
        .order('start_date', { ascending: true })
        .maybeSingle();

      if (error) throw error;
      return data as GroupItinerary | null;
    },
    enabled: !!conversationId,
  });
}

export function useCreateItinerary() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      conversation_id: string;
      title: string;
      start_date: string;
      end_date: string;
    }) => {
      const { data: itinerary, error } = await supabase
        .from('group_itineraries')
        .insert({
          ...data,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return itinerary;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group-itinerary', variables.conversation_id] });
      toast.success('Itinerary created');
    },
  });
}

export function useAddItineraryItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      itinerary_id: string;
      day_number: number;
      title: string;
      description?: string;
      location?: string;
      start_time?: string;
      end_time?: string;
      conversationId: string;
    }) => {
      const { conversationId, ...itemData } = data;
      const { error } = await supabase
        .from('itinerary_items')
        .insert({
          ...itemData,
          created_by: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group-itinerary', variables.conversationId] });
      toast.success('Item added');
    },
  });
}

export function useCommunityGroups() {
  return useQuery({
    queryKey: ['community-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          participants:conversation_participants(count)
        `)
        .eq('is_community_hub', true)
        .in('visibility', ['public', 'discoverable'])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversation_participants')
        .insert({
          conversation_id: conversationId,
          user_id: user?.id,
          role: 'member',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-groups'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Joined group');
    },
  });
}
