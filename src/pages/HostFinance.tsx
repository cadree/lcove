import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FinanceBack, FinanceScreen } from "@/components/events/host/FinanceScreen";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatUsd } from "@/lib/ticketFees";
import { errorMessage } from "@/lib/errorMessage";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface BalanceBucket { amount: number; currency: string }
interface FinancePayload {
  available?: BalanceBucket[];
  pending?: BalanceBucket[];
  country?: string | null;
  currency?: string | null;
  charges_enabled?: boolean;
  transfers_active?: boolean;
  payouts?: { id: string; amount: number; currency: string; status: string }[];
  methods?: { id: string; bank_name?: string; last4?: string; default_for_currency?: boolean }[];
  error?: string;
  url?: string;
}

function money(buckets: BalanceBucket[] | undefined, currency: string | null | undefined) {
  const match = (buckets || []).find((bucket) => bucket.currency === currency) || buckets?.[0];
  if (!match) return formatUsd(0);
  return formatUsd(match.amount);
}

export default function HostFinance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["host-finances", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: payload, error } = await supabase.functions.invoke("manage-creator-connect", { body: { action: "finances" } });
      if (error) throw error;
      return payload as FinancePayload;
    },
  });

  if (!user) {
    navigate("/auth?redirect=/dashboard/events/finances");
    return null;
  }

  const run = async (action: "transfer" | "add_payout_method") => {
    setBusy(true);
    try {
      const { data: payload, error } = await supabase.functions.invoke("manage-creator-connect", { body: { action } });
      if (error) throw error;
      if (payload?.error) throw new Error(payload.error);
      if (payload?.url) {
        window.location.href = payload.url;
        return;
      }
      toast.success(action === "transfer" ? "Transfer started." : "Payout method updated.");
      queryClient.invalidateQueries({ queryKey: ["host-finances", user.id] });
    } catch (failure) {
      toast.error(errorMessage(failure, "Stripe could not do that."));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background px-4 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <FinanceBack />
        <h1 className="ether-title text-3xl">Finances</h1>
        {isError ? (
          <div role="alert" className="mt-5 space-y-3 rounded-2xl border border-border/70 p-4 text-sm">
            <p>Your finances could not load right now.</p>
            <Button className="w-full rounded-full" disabled={isFetching} onClick={() => void refetch()}>
              {isFetching ? "Trying again…" : "Try again"}
            </Button>
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">Loading your finances…</p>
        )}
      </div>
    );
  }

  return (
    <FinanceScreen
      available={money(data.available, data.currency)}
      pending={money(data.pending, data.currency)}
      country={data.country || "Not set"}
      currency={(data.currency || "Not set").toUpperCase()}
      sales={data.charges_enabled === true}
      transfers={data.transfers_active === true}
      payouts={(data.payouts || []).map((payout) => ({
        id: payout.id,
        label: formatUsd(payout.amount),
        status: payout.status,
      }))}
      methods={(data.methods || []).map((method) => ({
        id: method.id,
        label: `${method.bank_name || "Bank"} ending in ${method.last4 || "••••"}`,
        isDefault: method.default_for_currency === true,
      }))}
      busy={busy}
      onTransfer={() => run("transfer")}
      onAddMethod={() => run("add_payout_method")}
    />
  );
}
