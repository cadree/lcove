import { useState } from "react";
import { motion } from "framer-motion";
import {
  CreditCard,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Clock,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useEventConnectStatus, useCreateEventConnectAccount } from "@/hooks/useEventConnectStatus";
import { cn } from "@/lib/utils";

export function PayoutSettings() {
  const { status, isLoading, refetch, isFullyOnboarded } = useEventConnectStatus();
  const createConnect = useCreateEventConnectAccount();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSetupPayouts = async () => {
    try {
      const result = await createConnect.mutateAsync();
      if (result?.url) {
        window.open(result.url, '_blank');
        toast.success('Opening Stripe Connect onboarding...');
      }
    } catch (error) {
      console.error('Error setting up payouts:', error);
      toast.error('Failed to start payout setup');
    }
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast.success('Status refreshed');
  };

  if (isLoading) {
    return (
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">Payout Settings</CardTitle>
              <CardDescription className="text-xs">
                Receive money from ticket sales
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Settings2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!status?.connected ? (
          // Not connected state
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Payouts Not Enabled</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Set up Stripe Connect to receive 80% of ticket sales directly to your bank account.
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSetupPayouts} 
              className="w-full gap-2"
              disabled={createConnect.isPending}
            >
              {createConnect.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Set Up Payouts
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              Without payouts enabled, ticket revenue goes to your LC Credits wallet instead.
            </p>
          </div>
        ) : !isFullyOnboarded ? (
          // Partially onboarded state
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Complete Your Setup</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your Stripe account needs additional information before you can receive payouts.
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSetupPayouts} 
              className="w-full gap-2"
              disabled={createConnect.isPending}
            >
              {createConnect.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Complete Setup
            </Button>
          </div>
        ) : (
          // Fully connected state
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-500">Payouts Enabled</span>
              </div>
            </div>

            {/* Balance Display */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Pending</span>
                </div>
                <p className="text-lg font-semibold">
                  ${(status.pendingBalance || 0).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Available</span>
                </div>
                <p className="text-lg font-semibold text-emerald-500">
                  ${(status.availableBalance || 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Revenue Split Info */}
            <div className="flex items-center justify-between py-2 border-t border-border/30">
              <div>
                <p className="text-xs font-medium">Revenue Split</p>
                <p className="text-[10px] text-muted-foreground">Per ticket sale</p>
              </div>
              <div className="text-right">
                <Badge variant="secondary" className="text-xs">
                  You: 80% • Platform: 20%
                </Badge>
              </div>
            </div>

            <Button 
              variant="outline" 
              onClick={handleSetupPayouts}
              className="w-full gap-2"
              disabled={createConnect.isPending}
            >
              <Settings2 className="h-4 w-4" />
              Manage Stripe Account
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
