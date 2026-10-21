import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { 
  Wallet, 
  ArrowUpRight, ArrowDownLeft, Coins, Send,
  Flame, Sparkles, Info
} from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits, useCreditLedger, usePayouts, useTransactions } from '@/hooks/useCredits';
import { connectSetupAction, connectStatusCopy, connectStatusLabel, resolveConnectStatus, useCreatorConnect, withdrawalsEnabled } from '@/hooks/useCreatorConnect';
import { useMyXp } from '@/hooks/useXp';
import { TotalBalanceCard, CreditBalanceCard } from '@/components/credits/CreditBalanceCard';
import { TransferCreditsDialog } from '@/components/credits/TransferCreditsDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SquircleIcon } from '@/components/world/SquircleIcon';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  processing: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  completed: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-red-500/20 text-red-600 dark:text-red-400',
  cancelled: 'bg-muted text-muted-foreground',
};

const WalletPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { credits, isLoading: creditsLoading, genesisBalance, earnedBalance, balance } = useCredits();
  const { data: myXp } = useMyXp();
  const { ledger, isLoading: ledgerLoading } = useCreditLedger();
  const {
    data: connect,
    isLoading: connectLoading,
    isError: connectFailed,
    error: connectError,
    refetch: refetchConnect,
    open: openConnect,
  } = useCreatorConnect();
  const { payouts, isLoading: payoutsLoading, requestPayout, isRequesting } = usePayouts();
  const { transactions, isLoading: transactionsLoading } = useTransactions();

  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const connectStatus = resolveConnectStatus(connect);
  const setupAction = connectSetupAction(connectStatus);
  const connectBadgeClass = connectStatus === "verified"
    ? statusColors.completed
    : connectStatus === "needs_info" || connectStatus === "pending"
      ? statusColors.pending
      : statusColors.processing;

  // Handle Stripe setup callback
  useEffect(() => {
    const connectResult = searchParams.get('connect');
    if (connectResult === 'success' || connectResult === 'refresh') {
      refetchConnect();
      toast({
        title: connectResult === 'success' ? 'Checking payout status' : 'Payout setup needs another step',
        description: connectResult === 'success'
          ? 'Stripe sent you back. Wallet shows whether you can accept payments and whether payouts are enabled.'
          : 'Open payout setup again to finish.',
      });
      searchParams.delete('connect');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, refetchConnect]);

  const handleRequestPayout = () => {
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }

    // Only allow payouts from Earned credits
    if (amount > earnedBalance) {
      toast({ 
        title: 'Insufficient Earned Credit', 
        description: 'Only Earned Credit can be converted to payouts. Genesis Credit cannot be withdrawn.',
        variant: 'destructive' 
      });
      return;
    }

    if (!withdrawalsEnabled(connect)) {
      const status = resolveConnectStatus(connect);
      toast({
        title: status === 'accepting' ? 'Payouts are under review' : 'Payouts are not enabled yet',
        description: connectStatusCopy(status),
        variant: 'destructive',
      });
      return;
    }
    requestPayout({ amount, use_credits: true });
    setPayoutDialogOpen(false);
    setPayoutAmount('');
  };

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <PageLayout>
        <div className="p-4 sm:p-6 pb-32 max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </PageLayout>
    );
  }

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
          eyebrow="Credits"
          title="Wallet"
          description={myXp ? `Ledger, payouts, and level ${myXp.level}` : "Ledger and payouts"}
          icon={<Wallet className="w-5 h-5" />}
          tile="gold"
          className="mb-6"
        />

        {/* Total Balance Card */}
        {creditsLoading ? (
          <Skeleton className="h-40 w-full mb-6" />
        ) : (
          <div className="mb-6">
            <TotalBalanceCard 
              genesisBalance={genesisBalance} 
              earnedBalance={earnedBalance} 
            />
          </div>
        )}

        {/* Genesis & Earned Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {creditsLoading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : (
            <>
              <CreditBalanceCard 
                type="genesis" 
                balance={genesisBalance}
                subtitle={credits?.genesis_burned ? `${credits.genesis_burned} burned` : undefined}
              />
              <CreditBalanceCard 
                type="earned" 
                balance={earnedBalance}
                subtitle={credits?.lifetime_earned ? `${credits.lifetime_earned} lifetime` : undefined}
              />
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button onClick={() => setTransferDialogOpen(true)}>
            <Send className="h-4 w-4 mr-2" />
            Send LC
          </Button>
          
          <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={earnedBalance <= 0}>
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Request Payout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Payout</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {/* Info about payout restrictions */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Only <span className="font-medium text-primary">Earned Credit</span> can be converted to payouts. 
                    Genesis Credit cannot be withdrawn.
                  </p>
                </div>

                <div>
                  <Label>Amount (from {earnedBalance} Earned LC)</Label>
                  <Input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="0"
                    min={1}
                    max={earnedBalance}
                  />
                </div>

                <p className="text-sm text-muted-foreground">
                  1 LC converts to $1. The 10% community-fund fee was already taken when the sale, gift, invoice, or project payment came in. This payout does not take it again.
                </p>

                <Button 
                  onClick={handleRequestPayout} 
                  disabled={!payoutAmount || !withdrawalsEnabled(connect) || isRequesting || parseFloat(payoutAmount) > earnedBalance}
                  className="w-full"
                >
                  {isRequesting ? 'Processing...' : 'Request Payout'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <p className="kicker">// Payout</p>
            <CardTitle className="ether-title text-[22px]">Stripe Connect</CardTitle>
            <CardDescription>One Express account for sales, gifts, invoices, films, and project pay. Test mode only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {connectLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : connectFailed ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">Status</span>
                  <Badge className={statusColors.failed}>Couldn't load</Badge>
                </div>
                <p className="text-sm text-destructive">
                  {connectError instanceof Error ? connectError.message : "The payout status call failed. Nothing was marked pending."}
                </p>
                <Button type="button" variant="outline" onClick={() => refetchConnect()}>
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-foreground">Status</span>
                  <Badge className={cn("h-auto max-w-[16rem] whitespace-normal text-right leading-snug", connectBadgeClass)}>
                    {connectStatusLabel(connectStatus)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{connectStatusCopy(connectStatus)}</p>
                <div className="flex flex-wrap gap-2">
                  {setupAction !== "manage" && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={openConnect.isPending}
                      onClick={() => openConnect.mutate("onboard")}
                    >
                      {setupAction === "continue" ? "Continue setup" : "Set up payouts"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!connect?.accountId || openConnect.isPending}
                    onClick={() => openConnect.mutate("dashboard")}
                  >
                    Manage payouts
                  </Button>
                </div>
                {openConnect.isError && (
                  <p className="text-sm text-destructive">{openConnect.error instanceof Error ? openConnect.error.message : "Could not open Stripe"}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Activity Tabs */}
        <Tabs defaultValue="all">
          <p className="kicker mb-2">// Ledger</p>
          <TabsList className="grid h-auto w-full grid-cols-4 gap-1 rounded-none border-0 bg-transparent p-0">
            <TabsTrigger value="all" className="mono-label h-11 rounded-none border-0 border-b-2 border-transparent text-[10px] shadow-none data-[state=active]:border-[hsl(var(--bubble))] data-[state=active]:bg-transparent data-[state=active]:shadow-none">All</TabsTrigger>
            <TabsTrigger value="genesis" className="mono-label h-11 rounded-none border-0 border-b-2 border-transparent text-[10px] shadow-none data-[state=active]:border-[hsl(var(--bubble))] data-[state=active]:bg-transparent data-[state=active]:shadow-none">Genesis</TabsTrigger>
            <TabsTrigger value="earned" className="mono-label h-11 rounded-none border-0 border-b-2 border-transparent text-[10px] shadow-none data-[state=active]:border-[hsl(var(--bubble))] data-[state=active]:bg-transparent data-[state=active]:shadow-none">Earned</TabsTrigger>
            <TabsTrigger value="payouts" className="mono-label h-11 rounded-none border-0 border-b-2 border-transparent text-[10px] shadow-none data-[state=active]:border-[hsl(var(--bubble))] data-[state=active]:bg-transparent data-[state=active]:shadow-none">Payouts</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <LedgerList ledger={ledger} isLoading={ledgerLoading} />
          </TabsContent>

          <TabsContent value="genesis" className="mt-4">
            <LedgerList 
              ledger={ledger.filter(e => e.credit_type === 'genesis')} 
              isLoading={ledgerLoading}
              emptyMessage="No Genesis Credit activity"
            />
          </TabsContent>

          <TabsContent value="earned" className="mt-4">
            <LedgerList 
              ledger={ledger.filter(e => e.credit_type === 'earned')} 
              isLoading={ledgerLoading}
              emptyMessage="No Earned Credit activity"
            />
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
                      <SquircleIcon icon={ArrowUpRight} fill="gold" size={32} glyph={16} />
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
        </Tabs>

        {/* Transfer Dialog */}
        <TransferCreditsDialog 
          open={transferDialogOpen} 
          onOpenChange={setTransferDialogOpen} 
        />
      </div>
    </PageLayout>
  );
};

// Ledger list component
interface LedgerListProps {
  ledger: Array<{
    id: string;
    amount: number;
    balance_after: number;
    description: string;
    credit_type: 'genesis' | 'earned';
    created_at: string;
    genesis_amount: number;
    earned_amount: number;
  }>;
  isLoading: boolean;
  emptyMessage?: string;
}

const LedgerList: React.FC<LedgerListProps> = ({ ledger, isLoading, emptyMessage = 'No credit activity yet' }) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }

  if (ledger.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Coins className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ledger.map((entry) => (
        <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              entry.amount > 0 
                ? "bg-emerald-500/20" 
                : entry.credit_type === 'genesis' 
                  ? "bg-orange-500/20" 
                  : "bg-red-500/20"
            )}>
              {entry.amount > 0 ? (
                <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
              ) : entry.credit_type === 'genesis' ? (
                <Flame className="h-4 w-4 text-orange-500" />
              ) : (
                <ArrowUpRight className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div>
              <p className="font-medium text-sm">{entry.description}</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {format(new Date(entry.created_at), 'MMM d, yyyy • h:mm a')}
                </p>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    entry.credit_type === 'genesis' 
                      ? "border-orange-500/30 text-orange-600 dark:text-orange-400" 
                      : "border-primary/30 text-primary"
                  )}
                >
                  {entry.credit_type === 'genesis' ? 'Genesis' : 'Earned'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className={cn(
              "font-semibold",
              entry.amount > 0 
                ? "text-emerald-500" 
                : entry.credit_type === 'genesis' 
                  ? "text-orange-500" 
                  : "text-red-500"
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
  );
};

export default WalletPage;
