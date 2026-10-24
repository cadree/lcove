import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { BackButton } from "@/components/navigation/BackButton";
import { ConfirmationScreen } from "@/components/events/guest/ConfirmationScreen";
import { supabase } from "@/integrations/supabase/client";
import { formatEventDate, formatEventTime } from "@/lib/eventTime";
import { buildShareUrl, shareLink } from "@/lib/shareLink";
import { errorMessage } from "@/lib/errorMessage";
import { toast } from "sonner";

export default function EventConfirmation() {
  const { eventId = "" } = useParams();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const orderIdParam = params.get("order_id");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketCount, setTicketCount] = useState(1);
  const [qr, setQr] = useState<string | null>(null);
  const [hostName, setHostName] = useState("Host");
  const [title, setTitle] = useState("");
  const [whenLabel, setWhenLabel] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [flyer, setFlyer] = useState<string | null>(null);
  const [hostAvatar, setHostAvatar] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [startIso, setStartIso] = useState<string | null>(null);
  const [endIso, setEndIso] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [walletEnabled, setWalletEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: event } = await supabase.from("events").select("id, title, start_date, end_date, venue, address, city, state, image_url, timezone, creator_id, hide_address, page_theme").eq("id", eventId).maybeSingle();
      if (cancelled || !event) return;
      setTitle(event.title);
      setFlyer(event.image_url);
      setTheme(event.page_theme === "light" ? "light" : "dark");
      setStartIso(event.start_date);
      setEndIso(event.end_date);
      setWhenLabel(`${formatEventDate(event.start_date, event.timezone)} · ${formatEventTime(event.start_date, event.timezone)}${event.end_date ? ` – ${formatEventTime(event.end_date, event.timezone)}` : ""}`);
      const { data: host } = await supabase.from("consumer_creators").select("display_name, avatar_url").eq("user_id", event.creator_id).maybeSingle();
      if (host?.display_name) setHostName(host.display_name);
      if (host?.avatar_url) setHostAvatar(host.avatar_url);
      const { data: hidden } = await supabase.rpc("public_event_location", { p_event_id: event.id, p_order_id: orderIdParam || undefined });
      setAddress(hidden || [event.venue, event.hide_address ? null : event.address, event.city].filter(Boolean).join(", "));
      const probe = await supabase.functions.invoke("generate-wallet-pass", { body: { probe: true } });
      if (!cancelled) setWalletEnabled(probe.data?.configured === true);
    };
    load();

    const verify = async () => {
      if (!sessionId && !orderIdParam) {
        setLoading(false);
        return;
      }
      try {
        const { data, error: invokeError } = await supabase.functions.invoke("verify-event-purchase", {
          body: { sessionId, orderId: orderIdParam, eventId },
        });
        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(data.error);
        const attendees = data?.attendees || [];
        setTicketCount(data?.order?.quantity || attendees.length || 1);
        setQr(attendees[0]?.qr_code || null);
        setLoading(false);
      } catch (failure) {
        if (!cancelled) {
          setError(errorMessage(failure, "Could not confirm the order"));
          setLoading(false);
        }
      }
    };
    verify();
    return () => { cancelled = true; };
  }, [eventId, orderIdParam, sessionId]);

  const share = () => shareLink({ title, text: `I'm going to ${title}`, url: buildShareUrl.event(eventId) });
  const calendar = () => {
    if (!startIso) return;
    const start = new Date(startIso);
    const end = endIso ? new Date(endIso) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${stamp(start)}/${stamp(end)}&location=${encodeURIComponent(address || "")}`, "_blank", "noopener");
  };

  const back = (
    <div className="px-4 pt-4">
      <BackButton showLabel label="Back to event" fallback={eventId ? `/event/${eventId}` : "/calendar"} />
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {back}
        <p className="px-4 py-16 text-sm text-muted-foreground">Confirming your place…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        {back}
        <p className="px-4 py-16 text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <>
    {back}
    <ConfirmationScreen
      hostName={hostName}
      hostAvatar={hostAvatar}
      theme={theme}
      flyerUrl={flyer}
      title={title}
      whenLabel={whenLabel}
      address={address}
      ticketCount={ticketCount}
      qrValue={qr}
      subscribed={subscribed}
      walletEnabled={walletEnabled}
      onUpdates={async () => {
        if (!("Notification" in window)) {
          toast.message("Updates stay in the confirmation email.");
          setSubscribed(true);
          return;
        }
        const permission = await Notification.requestPermission();
        setSubscribed(permission === "granted");
      }}
      onWallet={async () => {
        const { data, error: walletError } = await supabase.functions.invoke("generate-wallet-pass", {
          body: { eventId, eventTitle: title, venue: address, guestName: hostName, qrCode: qr, hostName },
        });
        if (walletError || !data?.pkpass) {
          toast.error("Wallet pass is not available.");
          return;
        }
        const bytes = Uint8Array.from(atob(data.pkpass), (char) => char.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.apple.pkpass" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = data.filename || "ticket.pkpass";
        link.click();
        URL.revokeObjectURL(url);
      }}
      onCalendar={calendar}
      onShare={share}
    />
    </>
  );
}
