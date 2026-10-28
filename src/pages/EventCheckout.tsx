import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { OrderSummaryScreen } from "@/components/events/guest/OrderSummaryScreen";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicEvent } from "@/hooks/usePublicEvent";
import { eventPublicPath, isEventUuid } from "../../functions/_shared/eventShare.js";
import { readTicketLines } from "@/lib/guestEvent";
import { formatUsd, priceCheckout } from "@/lib/ticketFees";
import { errorMessage } from "@/lib/errorMessage";
import { toast } from "sonner";

export default function EventCheckout() {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: event } = usePublicEvent(eventId);
  const eventKey = event?.id || (isEventUuid(eventId) ? eventId : "");
  const lines = useMemo(() => readTicketLines(eventKey), [eventKey]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: host } = useQuery({
    queryKey: ["public-event-organizer", event?.creator_id],
    enabled: !!event?.creator_id,
    queryFn: async () => {
      const { data } = await supabase.from("consumer_creators").select("display_name, avatar_url").eq("user_id", event!.creator_id).maybeSingle();
      return data;
    },
  });
  const { data: tiers = [] } = useQuery({
    queryKey: ["public-event-tier-picker", eventKey],
    enabled: !!eventKey,
    queryFn: async () => {
      const { data } = await supabase.from("ticket_tiers").select("id, name, price_cents, description").eq("event_id", eventKey);
      return data || [];
    },
  });

  const absorb = event?.absorb_fees === true;
  const chosen = lines.map((line) => {
    const tier = tiers.find((item) => item.id === line.tierId);
    return {
      tierId: line.tierId,
      name: tier?.name || "Ticket",
      description: tier?.description || "",
      priceCents: tier?.price_cents || 0,
      quantity: line.quantity,
    };
  });
  const priced = priceCheckout(chosen, absorb);
  const hostName = host?.display_name || "the host";

  const checkout = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Add your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Add a valid email.";
    if (event?.password_protected && !password.trim()) next.password = "This event needs the password.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    try {
      const headers: Record<string, string> = {};
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) headers.Authorization = `Bearer ${session.access_token}`;
      }
      const { data, error } = await supabase.functions.invoke("purchase-event-ticket", {
        body: {
          eventId: event?.id || eventKey,
          lines: chosen.map((line) => ({ tierId: line.tierId, quantity: line.quantity })),
          buyer: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: user ? undefined : phone.trim() || undefined,
          },
          marketingConsent: user ? consent : false,
          nearbyConsent: !user && consent,
          password,
        },
        headers,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.free && data?.url) {
        window.location.href = data.url;
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("Checkout did not start");
    } catch (error) {
      toast.error(errorMessage(error, "Checkout failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OrderSummaryScreen
      hostName={hostName}
      hostAvatar={host?.avatar_url}
      theme={event?.page_theme === "light" ? "light" : "dark"}
      lines={priced.lines.map((line) => ({
        id: line.tierId || line.name || "tier",
        name: line.name || "Ticket",
        quantity: line.quantity,
        priceLabel: formatUsd(line.unitAmount * line.quantity),
      }))}
      totalLabel={priced.total === 0 ? "Free" : formatUsd(priced.total)}
      free={priced.total === 0}
      name={name}
      email={email}
      passwordRequired={event?.password_protected === true}
      password={password}
      consent={consent}
      consentLabel={user ? undefined : "Keep me posted on events like this near me. Unsubscribe anytime."}
      phone={phone}
      onPhone={user ? undefined : setPhone}
      errors={errors}
      submitting={submitting}
      onName={setName}
      onEmail={setEmail}
      onPassword={setPassword}
      onConsent={setConsent}
      onBack={() => navigate(event ? `${eventPublicPath(event)}/tickets` : "/calendar")}
      onCheckout={checkout}
    />
  );
}
