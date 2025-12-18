import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface UserCredits {
  id: string;
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
}

export interface CreditLedgerEntry {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  type: 'earn' | 'spend' | 'transfer_in' | 'transfer_out' | 'payout_conversion' | 'refund';
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface PayoutMethod {
  id: string;
  user_id: string;
  type: 'bank_account' | 'debit_card' | 'apple_pay';
  stripe_payment_method_id: string | null;
  last_four: string | null;
  brand: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Payout {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  payout_method_id: string | null;
  project_id: string | null;
  error_message: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'project_payment' | 'payout' | 'credit_purchase' | 'credit_redemption' | 'refund';
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  description: string | null;
  created_at: string;
}

export const useCredits = (userId?: string) => {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  const { data: credits, isLoading } = useQuery({
    queryKey: ['user-credits', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;
      
      const { data, error } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', targetUserId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      return data ? {
        ...data,
        balance: Number(data.balance),
        lifetime_earned: Number(data.lifetime_earned),
        lifetime_spent: Number(data.lifetime_spent),
      } as UserCredits : null;
    },
    enabled: !!targetUserId,
  });

  return { credits, isLoading, balance: credits?.balance || 0 };
};

export const useCreditLedger = () => {
  const { user } = useAuth();

  const { data: ledger = [], isLoading } = useQuery({
    queryKey: ['credit-ledger', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      return data.map(entry => ({
        ...entry,
        amount: Number(entry.amount),
        balance_after: Number(entry.balance_after),
      })) as CreditLedgerEntry[];
    },
    enabled: !!user?.id,
  });

  return { ledger, isLoading };
};

export const usePayoutMethods = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['payout-methods', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('payout_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return data as PayoutMethod[];
    },
    enabled: !!user?.id,
  });

  const setupPayoutMethod = useMutation({
    mutationFn: async (type: 'checkout_setup' | 'setup_intent') => {
      const { data, error } = await supabase.functions.invoke('setup-payout-method', {
        body: { type }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
      queryClient.invalidateQueries({ queryKey: ['payout-methods'] });
    },
    onError: (error) => {
      toast({ title: 'Failed to setup payout method', description: error.message, variant: 'destructive' });
    },
  });

  const setDefaultMethod = useMutation({
    mutationFn: async (methodId: string) => {
      // First, unset all defaults
      await supabase
        .from('payout_methods')
        .update({ is_default: false })
        .eq('user_id', user?.id);

      // Then set the new default
      const { error } = await supabase
        .from('payout_methods')
        .update({ is_default: true })
        .eq('id', methodId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout-methods'] });
      toast({ title: 'Default payment method updated' });
    },
  });

  const deleteMethod = useMutation({
    mutationFn: async (methodId: string) => {
      const { error } = await supabase
        .from('payout_methods')
        .delete()
        .eq('id', methodId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout-methods'] });
      toast({ title: 'Payment method removed' });
    },
  });

  return {
    methods,
    isLoading,
    setupPayoutMethod: setupPayoutMethod.mutate,
    setDefaultMethod: setDefaultMethod.mutate,
    deleteMethod: deleteMethod.mutate,
    isSettingUp: setupPayoutMethod.isPending,
  };
};

export const usePayouts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['payouts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('payouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map(p => ({ ...p, amount: Number(p.amount) })) as Payout[];
    },
    enabled: !!user?.id,
  });

  const requestPayout = useMutation({
    mutationFn: async (params: {
      amount: number;
      payout_method_id?: string;
      project_id?: string;
      role_id?: string;
      use_credits?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('process-payout', {
        body: params
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      queryClient.invalidateQueries({ queryKey: ['credit-ledger'] });
      toast({ title: 'Payout requested successfully!' });
    },
    onError: (error) => {
      toast({ title: 'Payout failed', description: error.message, variant: 'destructive' });
    },
  });

  return {
    payouts,
    isLoading,
    requestPayout: requestPayout.mutate,
    isRequesting: requestPayout.isPending,
  };
};

export const useTransactions = () => {
  const { user } = useAuth();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data.map(t => ({ ...t, amount: Number(t.amount) })) as Transaction[];
    },
    enabled: !!user?.id,
  });

  return { transactions, isLoading };
};
