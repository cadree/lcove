import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface UserCredits {
  id: string;
  user_id: string;
  balance: number;
  genesis_balance: number;
  earned_balance: number;
  genesis_lifetime_minted: number;
  genesis_burned: number;
  lifetime_earned: number;
  lifetime_spent: number;
}

export interface CreditLedgerEntry {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  type: 'earn' | 'spend' | 'transfer_in' | 'transfer_out' | 'payout_conversion' | 'refund';
  credit_type: 'genesis' | 'earned';
  genesis_amount: number;
  earned_amount: number;
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  verified_by: string | null;
  verification_type: string | null;
  created_at: string;
}

export interface CreditContribution {
  id: string;
  user_id: string;
  contribution_type: 'project_work' | 'event_hosting' | 'event_participation' | 'mentorship' | 'community_help';
  reference_type: string | null;
  reference_id: string | null;
  amount_requested: number;
  amount_earned: number;
  status: 'pending' | 'verified' | 'rejected';
  verified_by: string | null;
  verified_at: string | null;
  description: string | null;
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

// Main credits hook with Genesis/Earned split
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
      
      if (!data) return null;

      return {
        ...data,
        balance: Number(data.balance),
        genesis_balance: Number(data.genesis_balance) || 0,
        earned_balance: Number(data.earned_balance) || 0,
        genesis_lifetime_minted: Number(data.genesis_lifetime_minted) || 0,
        genesis_burned: Number(data.genesis_burned) || 0,
        lifetime_earned: Number(data.lifetime_earned),
        lifetime_spent: Number(data.lifetime_spent),
      } as UserCredits;
    },
    enabled: !!targetUserId,
  });

  return { 
    credits, 
    isLoading, 
    balance: credits?.balance || 0,
    genesisBalance: credits?.genesis_balance || 0,
    earnedBalance: credits?.earned_balance || 0,
  };
};

// Credit ledger with type filtering
export const useCreditLedger = (creditType?: 'genesis' | 'earned') => {
  const { user } = useAuth();

  const { data: ledger = [], isLoading } = useQuery({
    queryKey: ['credit-ledger', user?.id, creditType],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (creditType) {
        query = query.eq('credit_type', creditType);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      return data.map(entry => ({
        ...entry,
        amount: Number(entry.amount),
        balance_after: Number(entry.balance_after),
        genesis_amount: Number(entry.genesis_amount) || 0,
        earned_amount: Number(entry.earned_amount) || 0,
      })) as CreditLedgerEntry[];
    },
    enabled: !!user?.id,
  });

  return { ledger, isLoading };
};

// Transfer credits to another user
export const useTransferCredits = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { recipient_id: string; amount: number; message?: string }) => {
      const { data, error } = await supabase.functions.invoke('transfer-credits', {
        body: params
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      queryClient.invalidateQueries({ queryKey: ['credit-ledger'] });
      toast({ 
        title: 'Transfer successful!',
        description: `Sent ${data.amount_transferred} LC to ${data.recipient_name}${data.genesis_burned > 0 ? ` (${data.genesis_burned} Genesis Credit burned)` : ''}`,
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Transfer failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
};

// Contribution claims
export const useContributions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: contributions = [], isLoading } = useQuery({
    queryKey: ['credit-contributions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('credit_contributions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CreditContribution[];
    },
    enabled: !!user?.id,
  });

  const createContribution = useMutation({
    mutationFn: async (params: {
      contribution_type: CreditContribution['contribution_type'];
      reference_type?: string;
      reference_id?: string;
      amount_requested: number;
      description?: string;
    }) => {
      const { data, error } = await supabase
        .from('credit_contributions')
        .insert({
          user_id: user?.id,
          ...params,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-contributions'] });
      toast({ title: 'Contribution submitted for verification' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to submit contribution', description: error.message, variant: 'destructive' });
    },
  });

  return {
    contributions,
    isLoading,
    createContribution: createContribution.mutate,
    isCreating: createContribution.isPending,
  };
};

// Pending contributions for verification (for project/event owners)
export const usePendingVerifications = (referenceType?: string, referenceId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: pendingContributions = [], isLoading } = useQuery({
    queryKey: ['pending-verifications', user?.id, referenceType, referenceId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('credit_contributions')
        .select('*')
        .eq('status', 'pending');

      if (referenceType && referenceId) {
        query = query.eq('reference_type', referenceType).eq('reference_id', referenceId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data as CreditContribution[];
    },
    enabled: !!user?.id,
  });

  const verifyContribution = useMutation({
    mutationFn: async (params: { contribution_id: string; action: 'verify' | 'reject'; amount_override?: number }) => {
      const { data, error } = await supabase.functions.invoke('verify-contribution', {
        body: params
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-verifications'] });
      queryClient.invalidateQueries({ queryKey: ['credit-contributions'] });
      toast({ 
        title: data.status === 'verified' 
          ? `Contribution verified (${data.amount_awarded} LC awarded)` 
          : 'Contribution rejected',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Verification failed', description: error.message, variant: 'destructive' });
    },
  });

  return {
    pendingContributions,
    isLoading,
    verifyContribution: verifyContribution.mutate,
    isVerifying: verifyContribution.isPending,
  };
};

// Payout methods
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
    mutationFn: async (type: 'checkout_setup' | 'setup_intent' | 'sync') => {
      const { data, error } = await supabase.functions.invoke('setup-payout-method', {
        body: { type }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to setup payout method', description: error.message, variant: 'destructive' });
    },
  });

  const setDefaultMethod = useMutation({
    mutationFn: async (methodId: string) => {
      await supabase
        .from('payout_methods')
        .update({ is_default: false })
        .eq('user_id', user?.id);

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

// Payouts
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
    onError: (error: Error) => {
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

// Transactions
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
