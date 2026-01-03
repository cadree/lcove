import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { 
  Wallet, Plus, CreditCard, Building2, Smartphone, Trash2, 
  Check, ArrowUpRight, ArrowDownLeft, Coins, Clock, CheckCircle, XCircle
} from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits, useCreditLedger, usePayoutMethods, usePayouts, useTransactions } from '@/hooks/useCredits';
import { CreditBadge } from '@/components/credits/CreditBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const payoutMethodIcons: Record<string, any> = {
  bank_account: Building2,
  debit_card: CreditCard,
  apple_pay: Smartphone,
};

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  processing: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-muted text-muted-foreground',
};

const WalletPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { credits, isLoading: creditsLoading } = useCredits();
  const { ledger, isLoading: ledgerLoading } = useCreditLedger();
  const { methods, isLoading: methodsLoading, setupPayoutMethod, setDefaultMethod, deleteMethod, isSettingUp } = usePayoutMethods();
  const { payouts, isLoading: payoutsLoading, requestPayout, isRequesting } = usePayouts();
  const { transactions, isLoading: transactionsLoading } = useTransactions();

  const [payoutAmount, setPayoutAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <PageLayout>
        <div className="p-4 sm:p-6 pb-32 max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageLayout>
    );
  }

  // Handle Stripe setup callback
  useEffect(() => {
    const setupResult = searchParams.get('setup');
    if (setupResult === 'success') {
      toast({ title: 'Payment method added successfully!' });
      // Sync payment methods from Stripe
      supabase.functions.invoke('setup-payout-method', {
        body: { type: 'sync' }
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['payout-methods'] });
      });
      // Clear the param
      searchParams.delete('setup');
      setSearchParams(searchParams, { replace: true });
    } else if (setupResult === 'cancelled') {
      toast({ title: 'Setup cancelled', variant: 'destructive' });
      searchParams.delete('setup');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, queryClient]);

  const handleRequestPayout = () => {
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }

    if (selectedMethod === 'credits') {
      requestPayout({ amount, use_credits: true });
    } else if (selectedMethod) {
      requestPayout({ amount, payout_method_id: selectedMethod });
    } else {
      toast({ title: 'Select a payout method', variant: 'destructive' });
      return;
    }
    setPayoutDialogOpen(false);
    setPayoutAmount('');
    setSelectedMethod(null);
  };

  if (!user) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Please sign in to view your wallet</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="p-4 sm:p-6 pb-32 max-w-4xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Wallet"
          description="Manage your LC Credits and payouts"
          icon={<Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
          className="mb-8"
        />

        {/* Balance Card */}
        <Card className="mb-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">LC Credit Balance</p>
                {creditsLoading ? (
                  <Skeleton className="h-10 w-32" />
                ) : (
                  <div className="flex items-center gap-2">
                    <Coins className="h-8 w-8 text-primary" />
                    <span className="text-4xl font-bold text-primary">
                      {(credits?.balance || 0).toLocaleString()}
                    </span>
                    <span className="text-xl text-primary/70">LC</span>
                  </div>
                )}
              </div>
              
              <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    Request Payout
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Payout</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Amount (USD)</Label>
                      <Input
                        type="number"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        placeholder="0.00"
                        min={1}
                      />
                    </div>

                    <div>
                      <Label>Payout Method</Label>
                      <div className="space-y-2 mt-2">
                        {/* Credits option */}
                        <div
                          onClick={() => setSelectedMethod('credits')}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            selectedMethod === 'credits' ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                          )}
                        >
                          <Coins className="h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <p className="font-medium">Convert to LC Credits</p>
                            <p className="text-xs text-muted-foreground">Instant • No fees</p>
                          </div>
                          {selectedMethod === 'credits' && <Check className="h-5 w-5 text-primary" />}
                        </div>

                        {/* Payment methods */}
                        {methods.map((method) => {
                          const Icon = payoutMethodIcons[method.type];
                          return (
                            <div
                              key={method.id}
                              onClick={() => setSelectedMethod(method.id)}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                                selectedMethod === method.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                              )}
                            >
                              <Icon className="h-5 w-5" />
                              <div className="flex-1">
                                <p className="font-medium capitalize">
                                  {method.brand || method.type.replace('_', ' ')} •••• {method.last_four}
                                </p>
                                <p className="text-xs text-muted-foreground">1-3 business days</p>
                              </div>
                              {selectedMethod === method.id && <Check className="h-5 w-5 text-primary" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Button 
                      onClick={handleRequestPayout} 
                      disabled={!payoutAmount || !selectedMethod || isRequesting}
                      className="w-full"
                    >
                      {isRequesting ? 'Processing...' : 'Request Payout'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {credits && (
              <div className="flex gap-6 mt-4 pt-4 border-t border-primary/20">
                <div>
                  <p className="text-xs text-muted-foreground">Lifetime Earned</p>
                  <p className="text-lg font-semibold text-emerald-400">+{credits.lifetime_earned.toLocaleString()} LC</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lifetime Spent</p>
                  <p className="text-lg font-semibold text-muted-foreground">-{credits.lifetime_spent.toLocaleString()} LC</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payout Methods */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Payout Methods</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setupPayoutMethod('checkout_setup')}
              disabled={isSettingUp}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Method
            </Button>
          </CardHeader>
          <CardContent>
            {methods.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No payout methods added yet</p>
                <p className="text-xs mt-1">Add a bank account or card to receive payouts</p>
              </div>
            ) : (
              <div className="space-y-2">
                {methods.map((method) => {
                  const Icon = payoutMethodIcons[method.type];
                  return (
                    <div key={method.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5" />
                        <div>
                          <p className="font-medium capitalize">
                            {method.brand || method.type.replace('_', ' ')} •••• {method.last_four}
                          </p>
                        </div>
                        {method.is_default && (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!method.is_default && (
                          <Button variant="ghost" size="sm" onClick={() => setDefaultMethod(method.id)}>
                            Set Default
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => deleteMethod(method.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Tabs */}
        <Tabs defaultValue="credits">
          <TabsList className="w-full">
            <TabsTrigger value="credits" className="flex-1">Credit History</TabsTrigger>
            <TabsTrigger value="payouts" className="flex-1">Payouts</TabsTrigger>
            <TabsTrigger value="transactions" className="flex-1">Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="credits" className="mt-4">
            {ledgerLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : ledger.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Coins className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No credit activity yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ledger.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        entry.amount > 0 ? "bg-emerald-500/20" : "bg-red-500/20"
                      )}>
                        {entry.amount > 0 ? (
                          <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{entry.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(entry.created_at), 'MMM d, yyyy • h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "font-semibold",
                        entry.amount > 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {entry.amount > 0 ? '+' : ''}{entry.amount} LC
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance: {entry.balance_after} LC
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="payouts" className="mt-4">
            {payouts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No payouts yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payouts.map((payout) => (
                  <div key={payout.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <ArrowUpRight className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Payout</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(payout.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <Badge className={statusColors[payout.status]}>
                        {payout.status}
                      </Badge>
                      <p className="font-semibold">${payout.amount.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transactions" className="mt-4">
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                    <div>
                      <p className="font-medium text-sm capitalize">{tx.type.replace('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.created_at), 'MMM d, yyyy')} • {tx.description}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <Badge className={statusColors[tx.status]}>
                        {tx.status}
                      </Badge>
                      <p className="font-semibold">${tx.amount.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default WalletPage;
