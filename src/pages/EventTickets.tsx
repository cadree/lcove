import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TicketPickerScreen } from "@/components/events/guest/TicketPickerScreen";
import { supabase } from "@/integrations/supabase/client";
import { saveTicketLines } from "@/lib/guestEvent";
import { tierPriceLabel } from "@/lib/ticketFees";

export default function EventTickets() {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const { data: event } = useQuery({
    queryKey: ["public-event", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("id, title, creator_id, absorb_fees, page_theme").eq("id", eventId).single();
      if (error) throw error;
      return data;
    },
  });
  const { data: host } = useQuery({
    queryKey: ["public-event-organizer", event?.creator_id],
    enabled: !!event?.creator_id,
    queryFn: async () => {
      const { data } = await supabase.from("consumer_creators").select("display_name, avatar_url").eq("user_id", event!.creator_id).maybeSingle();
      return data;
    },
  });
  const { data: tiers = [] } = useQuery({
    queryKey: ["public-event-tier-picker", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase.from("ticket_tiers").select("id, name, description, price_cents, capacity, quantity_sold, is_active").eq("event_id", eventId).eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  const absorb = event?.absorb_fees === true;
  const rows = useMemo(() => tiers.map((tier) => {
    const left = tier.capacity == null ? 20 : Math.max(0, tier.capacity - (tier.quantity_sold || 0));
    return {
      id: tier.id,
      name: tier.name,
      priceLabel: tierPriceLabel(tier.price_cents || 0, absorb),
      description: tier.description,
      soldOut: left === 0,
      quantity: quantities[tier.id] || 0,
      max: Math.min(20, left),
    };
  }), [tiers, quantities, absorb]);

  return (
    <TicketPickerScreen
      title={event?.title || "Tickets"}
      hostName={host?.display_name || "Host"}
      hostAvatar={host?.avatar_url}
      theme={event?.page_theme === "light" ? "light" : "dark"}
      tiers={rows}
      onChange={(id, quantity) => setQuantities((current) => ({ ...current, [id]: Math.max(0, quantity) }))}
      onBack={() => navigate(`/event/${eventId}`)}
      onContinue={() => {
        saveTicketLines(eventId, rows.map((tier) => ({ tierId: tier.id, quantity: tier.quantity })));
        navigate(`/event/${eventId}/checkout`);
      }}
    />
  );
}
