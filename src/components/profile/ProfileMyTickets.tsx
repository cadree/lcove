import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Ticket, ChevronRight, X } from "lucide-react";
import { format, isPast } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMyTicketOrders, type MyTicketOrder } from "@/hooks/useMyTicketOrders";

export function ProfileMyTickets() {
  const { data: orders = [], isLoading } = useMyTicketOrders();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { upcoming, past } = useMemo(() => {
    const upcoming: MyTicketOrder[] = [];
    const past: MyTicketOrder[] = [];
    for (const o of orders) {
      if (!o.event) continue;
      const end = new Date(o.event.end_date || o.event.start_date);
      if (isPast(end)) past.push(o);
      else upcoming.push(o);
    }
    upcoming.sort((a, b) => new Date(a.event!.start_date).getTime() - new Date(b.event!.start_date).getTime());
    return { upcoming, past };
  }, [orders]);

  if (isLoading || orders.length === 0) return null;

  const renderOrder = (o: MyTicketOrder) => {
    if (!o.event) return null;
    const start = new Date(o.event.start_date);
    const isOpen = expanded === o.id;
    const isPaid = o.payment_status === "paid";
    return (
      <Card key={o.id} className="overflow-hidden bg-muted/30 border-border/50">
        <Collapsible open={isOpen} onOpenChange={(v) => setExpanded(v ? o.id : null)}>
          <CollapsibleTrigger asChild>
            <button className="w-full text-left flex gap-3 hover:bg-muted/50 transition-colors">
              {o.event.image_url ? (
                <img src={o.event.image_url} alt="" className="w-20 h-20 object-cover shrink-0" />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shrink-0">
                  <Ticket className="w-7 h-7 text-primary/60" />
                </div>
              )}
              <div className="flex-1 min-w-0 py-2 pr-2">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-medium text-sm truncate">{o.event.title}</h3>
                  <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{format(start, "MMM d, h:mm a")}</span>
                </div>
                {(o.event.venue || o.event.city) && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{[o.event.venue, o.event.city].filter(Boolean).join(", ")}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <Badge className="text-[10px] py-0 h-4 bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                    {o.quantity} ticket{o.quantity > 1 ? "s" : ""}
                  </Badge>
                  {!isPaid && <Badge variant="outline" className="text-[10px] py-0 h-4 capitalize">{o.payment_status}</Badge>}
                  {o.total_cents > 0 && (
                    <span className="text-[10px] text-muted-foreground">${(o.total_cents / 100).toFixed(2)}</span>
                  )}
                </div>
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border/30 p-3 space-y-2 bg-background/50">
              {o.attendees.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No tickets attached.</p>
              )}
              {o.attendees.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/40">
                  <div className="bg-white p-1.5 rounded shrink-0">
                    <QRCodeSVG value={a.qr_code} size={64} level="M" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.attendee_name || "Attendee"}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">#{a.ticket_number}</p>
                    <Badge variant="outline" className="text-[9px] py-0 h-4 mt-0.5 capitalize">{a.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Ticket className="w-4 h-4 text-primary" />
        <h2 className="font-display text-base">My Tickets</h2>
        <span className="text-xs text-muted-foreground">({orders.length})</span>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-3">
          <TabsTrigger value="upcoming" className="text-xs">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past" className="text-xs">Past ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="space-y-2 mt-0">
          {upcoming.length > 0 ? upcoming.map(renderOrder) : (
            <p className="text-center text-xs text-muted-foreground py-6">No upcoming events</p>
          )}
        </TabsContent>
        <TabsContent value="past" className="space-y-2 mt-0">
          {past.length > 0 ? past.map(renderOrder) : (
            <p className="text-center text-xs text-muted-foreground py-6">No past events</p>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
