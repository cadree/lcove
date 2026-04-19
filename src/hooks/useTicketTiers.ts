import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TicketTier {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  credits_price: number;
  capacity: number | null;
  quantity_sold: number;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  is_active: boolean;
  sort_order: number;
}

export function useTicketTiers(eventId?: string | null) {
  return useQuery({
    queryKey: ["ticket-tiers", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_tiers")
        .select("*")
        .eq("event_id", eventId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as TicketTier[];
    },
  });
}

export function useUpsertTicketTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tier: Partial<TicketTier> & { event_id: string; name: string }) => {
      if (tier.id) {
        const { error } = await supabase.from("ticket_tiers").update({
          name: tier.name,
          description: tier.description ?? null,
          price_cents: tier.price_cents ?? 0,
          credits_price: tier.credits_price ?? 0,
          capacity: tier.capacity ?? null,
          is_active: tier.is_active ?? true,
          sort_order: tier.sort_order ?? 0,
          sale_starts_at: tier.sale_starts_at ?? null,
          sale_ends_at: tier.sale_ends_at ?? null,
        }).eq("id", tier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ticket_tiers").insert({
          event_id: tier.event_id,
          name: tier.name,
          description: tier.description ?? null,
          price_cents: tier.price_cents ?? 0,
          currency: "usd",
          credits_price: tier.credits_price ?? 0,
          capacity: tier.capacity ?? null,
          is_active: tier.is_active ?? true,
          sort_order: tier.sort_order ?? 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["ticket-tiers", vars.event_id] });
      toast.success("Tier saved");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to save tier"),
  });
}

export function useDeleteTicketTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, event_id }: { id: string; event_id: string }) => {
      const { error } = await supabase.from("ticket_tiers").delete().eq("id", id);
      if (error) throw error;
      return { event_id };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["ticket-tiers", data.event_id] });
      toast.success("Tier removed");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete tier"),
  });
}
