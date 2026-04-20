import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Calendar, Ticket, ArrowLeft, Share2, MapPin, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/layout/PageLayout";
import { AddToCalendarButtons } from "@/components/calendar/AddToCalendarButtons";
import { shareLink, buildShareUrl } from "@/lib/shareLink";

interface Attendee {
  id: string;
  qr_code: string;
  ticket_number: string;
  attendee_name: string | null;
  attendee_email: string | null;
  status: string;
}
interface Order {
  id: string;
  payment_status: string;
  quantity: number;
  total_cents: number;
  currency: string;
}
interface EventInfo {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  venue: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

export default function EventConfirmation() {
  const { eventId } = useParams<{ eventId: string }>();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const orderIdParam = params.get("order_id");
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-event-purchase", {
          body: { sessionId, orderId: orderIdParam },
        });
        if (cancelled) return;
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setOrder(data.order);
        setAttendees(data.attendees || []);
        if (data.order?.payment_status !== "paid" && attempts < 5) {
          attempts++;
          setTimeout(verify, 1500);
          return;
        }
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e.message || "Failed to verify purchase");
        setLoading(false);
      }
    };
    if (eventId) {
      supabase
        .from("events")
        .select("id, title, description, start_date, end_date, venue, address, city, state")
        .eq("id", eventId)
        .single()
        .then(({ data }) => {
          if (data && !cancelled) setEvent(data as EventInfo);
        });
    }
    verify();
    return () => { cancelled = true; };
  }, [sessionId, orderIdParam, eventId]);

  const locationStr = event ? [event.venue, event.address, event.city, event.state].filter(Boolean).join(", ") : "";
  const directionsUrl = locationStr
    ? `https://maps.google.com/?q=${encodeURIComponent(locationStr)}`
    : null;

  const handleShare = async () => {
    if (!event) return;
    await shareLink({
      title: event.title,
      text: `I'm going to ${event.title}!`,
      url: buildShareUrl.event(event.id),
    });
  };

  return (
    <PageLayout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link to={`/event/${eventId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to event
        </Link>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-sm text-muted-foreground">Confirming your tickets…</p>
          </div>
        ) : error ? (
          <Card className="p-6 text-center">
            <p className="text-destructive font-medium mb-2">Something went wrong</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </Card>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card className="p-6 text-center bg-gradient-to-br from-emerald-500/10 to-emerald-500/0 border-emerald-500/30">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h1 className="text-xl font-display font-semibold">You're in!</h1>
              <p className="text-sm text-muted-foreground mt-1">{event?.title}</p>
              {order && (
                <p className="text-xs text-muted-foreground mt-2">
                  {order.quantity} ticket{order.quantity > 1 ? "s" : ""} · {order.total_cents === 0 ? "Free" : `$${(order.total_cents / 100).toFixed(2)}`}
                </p>
              )}
            </Card>

            {/* Quick actions */}
            {event && (
              <Card className="p-4 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <AddToCalendarButtons
                    variant="compact"
                    event={{
                      title: event.title,
                      description: event.description,
                      startDate: new Date(event.start_date),
                      endDate: event.end_date ? new Date(event.end_date) : null,
                      location: locationStr || null,
                      url: buildShareUrl.event(event.id),
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={handleShare}>
                    <Share2 className="w-4 h-4 mr-2" /> Share
                  </Button>
                  {directionsUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                        <MapPin className="w-4 h-4 mr-2" /> Directions
                      </a>
                    </Button>
                  )}
                </div>
              </Card>
            )}

            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Ticket className="w-4 h-4" /> Your tickets
              </h2>
              {attendees.map((a) => (
                <Card key={a.id} className="p-4 flex gap-4 items-center">
                  <div className="bg-white p-2 rounded">
                    <QRCodeSVG value={a.qr_code} size={96} level="M" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{a.attendee_name || "Attendee"}</p>
                    {a.attendee_email && <p className="text-xs text-muted-foreground truncate">{a.attendee_email}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1 font-mono">#{a.ticket_number}</p>
                    <Badge variant="outline" className="text-[10px] mt-1 capitalize">{a.status}</Badge>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="p-4 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <Calendar className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <span>Your tickets are saved to your profile under <strong>My Tickets</strong>. Show the QR code at the door.</span>
              </p>
            </Card>

            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1"><Link to={`/event/${eventId}`}>Event details</Link></Button>
              <Button asChild className="flex-1"><Link to="/profile">
                <User className="w-4 h-4 mr-2" />My Tickets
              </Link></Button>
            </div>
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
}
