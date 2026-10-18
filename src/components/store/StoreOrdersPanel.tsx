import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMyOrders, useStoreOrders, StoreOrder } from '@/hooks/useStore';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

function money(order: StoreOrder) {
  if (order.payment_type === 'credits') return `${order.credits_spent} LC`;
  return `$${Number(order.total_price).toFixed(2)}`;
}

function OrderList({
  title,
  orders,
  loading,
  canRefund,
}: {
  title: string;
  orders: StoreOrder[] | undefined;
  loading: boolean;
  canRefund: boolean;
}) {
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const refund = async (orderId: string) => {
    setRefundingId(orderId);
    try {
      const { data, error } = await supabase.functions.invoke('refund-store-order', {
        body: { orderId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await queryClient.invalidateQueries({ queryKey: ['store-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      toast.success('Refund sent');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refund failed';
      toast.error(message);
    } finally {
      setRefundingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : !orders || orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3 last:border-0">
              <div>
                <p className="font-medium">{order.item?.title || 'Item'}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString()} · {money(order)} · qty {order.quantity}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{order.status}</Badge>
                {canRefund && order.payment_type === 'cash' && (order.status === 'confirmed' || order.status === 'completed') && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={refundingId === order.id}
                    onClick={() => refund(order.id)}
                  >
                    {refundingId === order.id ? 'Refunding...' : 'Refund'}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function SellerOrders() {
  const { data, isLoading, isError, refetch } = useStoreOrders();
  if (isError) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm">Seller orders could not be loaded.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }
  return <OrderList title="Orders to fulfill" orders={data} loading={isLoading} canRefund />;
}

export function BuyerOrders() {
  const { data, isLoading, isError, refetch } = useMyOrders();
  if (isError) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm">Your orders could not be loaded.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }
  return <OrderList title="Your orders" orders={data} loading={isLoading} canRefund={false} />;
}
