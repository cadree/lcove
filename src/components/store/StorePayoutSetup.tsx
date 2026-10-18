import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useStoreConnectStatus, useCreateStoreConnectAccount, useStoreEarnings } from '@/hooks/useStoreConnect';
import { useToast } from '@/hooks/use-toast';
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  DollarSign,
  TrendingUp,
  Percent
} from 'lucide-react';
import { STORE_PLATFORM_FEE_PERCENT } from '@/lib/fees';

interface StorePayoutSetupProps {
  storeId: string;
  storeName: string;
}

export const StorePayoutSetup = ({ storeId, storeName }: StorePayoutSetupProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  const { data: connectStatus, isLoading: statusLoading, refetch } = useStoreConnectStatus(storeId);
  const { data: earnings, isLoading: earningsLoading } = useStoreEarnings(storeId);
  const createConnectAccount = useCreateStoreConnectAccount();

  // Handle return from Stripe Connect onboarding
  useEffect(() => {
    if (searchParams.get('connect_success') === 'true') {
      toast({
        title: 'Payout setup complete!',
        description: 'Your store can now receive automatic payouts.',
      });
      refetch();
      searchParams.delete('connect_success');
      setSearchParams(searchParams);
    } else if (searchParams.get('connect_refresh') === 'true') {
      toast({
        title: 'Please complete payout setup',
        description: 'Click "Set Up Payouts" to continue.',
        variant: 'destructive',
      });
      searchParams.delete('connect_refresh');
      setSearchParams(searchParams);
    }
  }, [searchParams, refetch, toast, setSearchParams]);

  const handleSetupPayouts = () => {
    createConnectAccount.mutate(storeId);
  };

  const isFullySetup = connectStatus?.chargesEnabled && connectStatus?.payoutsEnabled && connectStatus?.detailsSubmitted;

  if (statusLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Payout Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Payout Settings</CardTitle>
            </div>
            {isFullySetup ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : connectStatus?.hasAccount ? (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
                <AlertCircle className="h-3 w-3 mr-1" />
                Incomplete
              </Badge>
            ) : (
              <Badge variant="outline">Not Set Up</Badge>
            )}
          </div>
          <CardDescription>
            Set up payouts for sales made through Ether checkout. You receive {100 - STORE_PLATFORM_FEE_PERCENT}% of the item price. Ether keeps {STORE_PLATFORM_FEE_PERCENT}%. Linked Shopify sales are not paid here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!connectStatus?.hasAccount ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">How it works:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• You receive <strong>{100 - STORE_PLATFORM_FEE_PERCENT}%</strong> of the item price on Ether checkout</li>
                  <li>• Ether collects <strong>{STORE_PLATFORM_FEE_PERCENT}%</strong> on those sales. Shipping and tax are not part of the fee</li>
                  <li>• Linked Shopify sales are paid on Shopify. Ether does not take a fee</li>
                  <li>• Cash payments are transferred directly to your bank</li>
                  <li>• Credit payments are added to your LC balance</li>
                </ul>
              </div>
              <Button 
                onClick={handleSetupPayouts}
                disabled={createConnectAccount.isPending}
              >
                {createConnectAccount.isPending ? 'Setting up...' : 'Set Up Payouts'}
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          ) : !isFullySetup ? (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-600">
                  Your payout account setup is incomplete. Please complete the verification to start receiving payments.
                </p>
              </div>
              <Button 
                onClick={handleSetupPayouts}
                disabled={createConnectAccount.isPending}
              >
                {createConnectAccount.isPending ? 'Loading...' : 'Complete Setup'}
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          ) : (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm text-green-600">
                Your payouts are fully configured. Ether checkout sends you {100 - STORE_PLATFORM_FEE_PERCENT}% of the item price. Linked Shopify sales are paid on Shopify.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Earnings Summary Card */}
      {earnings && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Earnings Summary</CardTitle>
            </div>
            <CardDescription>
              Your store performance at a glance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-1 text-muted-foreground text-sm mb-1">
                  <DollarSign className="h-3 w-3" />
                  Gross Sales
                </div>
                <p className="text-xl font-semibold">{earnings.totalGross.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg">
                <div className="flex items-center gap-1 text-green-600 text-sm mb-1">
                  <TrendingUp className="h-3 w-3" />
                  Your Earnings ({100 - STORE_PLATFORM_FEE_PERCENT}%)
                </div>
                <p className="text-xl font-semibold text-green-600">{earnings.totalSellerAmount.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-1 text-muted-foreground text-sm mb-1">
                  <Percent className="h-3 w-3" />
                  Platform Fee ({STORE_PLATFORM_FEE_PERCENT}%)
                </div>
                <p className="text-xl font-semibold">{earnings.totalPlatformFee.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-muted-foreground text-sm mb-1">Total Orders</div>
                <p className="text-xl font-semibold">{earnings.orderCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
