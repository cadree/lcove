import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PublicEventScreen } from "@/components/events/guest/PublicEventScreen";
import { ReportDialog } from "@/components/safety/ReportDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { useConversations } from "@/hooks/useConversations";
import { BackButton } from "@/components/navigation/BackButton";
import { formatEventDate, formatEventTime } from "@/lib/eventTime";
import { backTarget } from "@/lib/goBack";
import { lowestBuyerCents } from "@/lib/ticketFees";
import { stickyCtaLabel } from "@/lib/guestEvent";
import { buildShareUrl, shareLink } from "@/lib/shareLink";
import { PageMeta } from "@/components/seo/PageMeta";
import { toast } from "sonner";

const savedKey = "ether-saved-events";

function readSaved(id: string) {
  try {
    const list = JSON.parse(localStorage.getItem(savedKey) || "[]");
    return Array.isArray(list) && list.includes(id);
  } catch {
    return false;
  }
}

export default function PublicEventPage() {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { createDirectConversation } = useConversations();
  const [saved, setSaved] = useState(() => readSaved(eventId));
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [location, setLocation] = useState<string | null>(null);

  const { data: event, isLoading } = useQuery({
    queryKey: ["public-event", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId).or("status.is.null,status.neq.draft").single();
      if (error) throw error;
      return data;
    },
  });

  const { data: host } = useQuery({
    queryKey: ["public-event-organizer", event?.creator_id],
    enabled: !!event?.creator_id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles_public").select("display_name, avatar_url, social_links").eq("user_id", event!.creator_id).maybeSingle();
      return data;
    },
  });

  const { data: going = 0 } = useQuery({
    queryKey: ["public-event-attendee-count", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_event_attendance_count", { p_event_id: eventId });
      if (error) throw error;
      return data ?? 0;
    },
  });

  const { data: preview } = useQuery({
    queryKey: ["public-event-guests", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_event_guest_preview", { p_event_id: eventId });
      if (error) return { names: [] as string[], avatars: [] as (string | null)[] };
      const row = (data || {}) as { names?: unknown; avatars?: unknown };
      return {
        names: Array.isArray(row.names) ? row.names.filter((name): name is string => typeof name === "string") : [],
        avatars: Array.isArray(row.avatars) ? row.avatars.map((item) => (typeof item === "string" ? item : null)) : [],
      };
    },
  });

  const { data: hostStats } = useQuery({
    queryKey: ["public-host-stats", event?.creator_id],
    enabled: !!event?.creator_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_host_stats", { p_user_id: event!.creator_id });
      if (error) return { events: 0, attendees: 0 };
      const row = (data || {}) as { events?: number; attendees?: number };
      return { events: row.events || 0, attendees: row.attendees || 0 };
    },
  });

  const { data: tiers = [] } = useQuery({
    queryKey: ["public-event-tiers", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase.from("ticket_tiers").select("id, name, price_cents, capacity, quantity_sold, is_active, description").eq("event_id", eventId).eq("is_active", true);
      return data || [];
    },
  });

  const { data: branding } = useQuery({
    queryKey: ["public-event-brand", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase.from("event_email_branding").select("brand_color, organizer_name").eq("event_id", eventId).maybeSingle();
      return data;
    },
  });

  const model = useMemo(() => {
    if (!event) return null;
    const absorb = event.absorb_fees === true;
    const paid = tiers.some((tier) => (tier.price_cents || 0) > 0);
    const from = lowestBuyerCents(tiers, absorb);
    const end = event.end_date || event.start_date;
    return {
      title: event.title,
      summary: event.description,
      flyerUrl: event.image_url,
      fontId: event.flyer_font,
      theme: event.page_theme === "light" ? "light" as const : "dark" as const,
      brandColor: branding?.brand_color || null,
      whenLabel: `${formatEventDate(event.start_date, event.timezone)} · ${formatEventTime(event.start_date, event.timezone)}${event.end_date ? ` – ${formatEventTime(event.end_date, event.timezone)}` : ""}`,
      venue: event.venue,
      addressHidden: event.hide_address === true,
      location,
      hostName: branding?.organizer_name || host?.display_name || "Host",
      hostAvatar: host?.avatar_url || null,
      hostEvents: hostStats?.events || 0,
      hostAttendees: hostStats?.attendees || 0,
      guestNames: preview?.names || [],
      guestAvatars: preview?.avatars || [],
      going: going || 0,
      cta: stickyCtaLabel(paid ? from : 0, !paid),
      saved,
      past: new Date(end) < new Date(),
    };
  }, [event, tiers, branding, host, hostStats, preview, going, location, saved]);

  const showLocation = async () => {
    if (!event) return;
    if (!event.hide_address) {
      const text = [event.venue, event.address, event.city, event.state].filter(Boolean).join(", ");
      setLocation(text);
      if (text) window.open(`https://maps.google.com/?q=${encodeURIComponent(text)}`, "_blank", "noopener");
      return;
    }
    const { data } = await supabase.rpc("public_event_location", { p_event_id: event.id });
    if (!data) {
      toast.message("The address stays hidden until you RSVP.");
      return;
    }
    setLocation(data);
    window.open(`https://maps.google.com/?q=${encodeURIComponent(data)}`, "_blank", "noopener");
  };

  const goBack = () => {
    const target = backTarget(typeof window === "undefined" ? null : window.history.state, "/calendar");
    if (target === -1) navigate(-1);
    else navigate(target);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-4 pt-4"><BackButton label="Back" fallback="/calendar" /></div>
      </div>
    );
  }
  if (!event || !model) {
    return (
      <div className="min-h-screen bg-background px-6 py-16 text-center">
        <BackButton showLabel label="Back" fallback="/calendar" className="mb-6" />
        <h1 className="ether-title text-3xl">Event not found</h1>
      </div>
    );
  }

  return (
    <>
      <PageMeta title={`${event.title}`} description={event.description || event.title} image={event.image_url || undefined} />
      <PublicEventScreen
        model={model}
        following={!!event.creator_id && isFavorite(event.creator_id)}
        onBack={goBack}
        onSave={() => {
          const list = readSaved(event.id) ? JSON.parse(localStorage.getItem(savedKey) || "[]").filter((id: string) => id !== event.id) : [...(JSON.parse(localStorage.getItem(savedKey) || "[]") as string[]), event.id];
          localStorage.setItem(savedKey, JSON.stringify(list));
          setSaved(readSaved(event.id));
        }}
        onShare={() => shareLink({ title: event.title, text: event.title, url: buildShareUrl.event(event.id) })}
        onLocation={showLocation}
        onGuestlist={() => setGuestsOpen(true)}
        onFollow={() => {
          if (!user) {
            navigate(`/auth?redirect=/event/${event.id}`);
            return;
          }
          if (!event.creator_id) return;
          if (isFavorite(event.creator_id)) removeFavorite.mutate(event.creator_id);
          else addFavorite.mutate(event.creator_id);
        }}
        onCalendar={() => {
          const start = new Date(event.start_date);
          const end = event.end_date ? new Date(event.end_date) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
          const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
          const where = [event.venue, event.city].filter(Boolean).join(", ");
          window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${stamp(start)}/${stamp(end)}&location=${encodeURIComponent(where)}`, "_blank", "noopener");
        }}
        onContact={async () => {
          if (!user || !event.creator_id) {
            navigate(`/auth?redirect=/event/${event.id}`);
            return;
          }
          const conversation = await createDirectConversation.mutateAsync(event.creator_id);
          navigate(`/messages?chat=${conversation.id}`);
        }}
        onReport={() => setReportOpen(true)}
        onCta={() => navigate(`/event/${event.id}/tickets`)}
      />
      <Dialog open={guestsOpen} onOpenChange={setGuestsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Guestlist</DialogTitle></DialogHeader>
          <ul className="space-y-2 text-sm">
            {(preview?.names || []).map((name) => <li key={name}>{name}</li>)}
            {(preview?.names || []).length === 0 && <li className="text-muted-foreground">No one yet.</li>}
          </ul>
        </DialogContent>
      </Dialog>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="event" targetId={event.id} />
    </>
  );
}
