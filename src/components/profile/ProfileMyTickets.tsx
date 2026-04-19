import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, Ticket, X, ChevronRight } from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { useMyRSVPs, useCancelRSVP } from "@/hooks/useMyRSVPs";
import { EventDetailDialog } from "@/components/calendar/EventDetailDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ProfileMyTickets() {
  const { data: rsvps = [], isLoading } = useMyRSVPs();
  const cancel = useCancelRSVP();
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const { upcoming, past } = useMemo(() => {
    const upcoming: typeof rsvps = [];
    const past: typeof rsvps = [];
    for (const r of rsvps) {
      if (!r.event) continue;
      const end = new Date(r.event.end_date || r.event.start_date);
      if (isPast(end)) past.push(r);
      else upcoming.push(r);
    }
    upcoming.sort((a, b) => new Date(a.event!.start_date).getTime() - new Date(b.event!.start_date).getTime());
    return { upcoming, past };
  }, [rsvps]);

  if (isLoading || rsvps.length === 0) return null;

  const renderCard = (r: typeof rsvps[number]) => {
    if (!r.event) return null;
    const start = new Date(r.event.start_date);
    const upcoming = !isPast(new Date(r.event.end_date || r.event.start_date));
    return (
      <Card
        key={r.id}
        className="overflow-hidden bg-muted/30 border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setOpenEventId(r.event_id)}
      >
        <div className="flex gap-3">
          {r.event.image_url ? (
            <img src={r.event.image_url} alt="" className="w-20 h-20 object-cover shrink-0" />
          ) : (
            <div className="w-20 h-20 bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shrink-0">
              <Ticket className="w-7 h-7 text-primary/60" />
            </div>
          )}
          <div className="flex-1 min-w-0 py-2 pr-2">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-medium text-sm truncate">{r.event.title}</h3>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>{format(start, 'MMM d, h:mm a')}</span>
            </div>
            {(r.event.venue || r.event.city) && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{[r.event.venue, r.event.city].filter(Boolean).join(', ')}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {r.ticket_purchased && (
                <Badge className="text-[10px] py-0 h-4 bg-emerald-500/20 text-emerald-600 border-emerald-500/30">Ticket</Badge>
              )}
              <Badge variant="outline" className="text-[10px] py-0 h-4 capitalize">{r.status}</Badge>
              {upcoming && (
                <span className="text-[10px] text-primary flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDistanceToNow(start, { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>
        {upcoming && (
          <div className="border-t border-border/30 px-2 py-1 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                cancel.mutate(r.id);
              }}
            >
              <X className="w-3 h-3 mr-1" />
              Cancel RSVP
            </Button>
          </div>
        )}
      </Card>
    );
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 py-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Ticket className="w-4 h-4 text-primary" />
          <h2 className="font-display text-base">My Tickets & RSVPs</h2>
          <span className="text-xs text-muted-foreground">({rsvps.length})</span>
        </div>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="upcoming" className="text-xs">
              Upcoming ({upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="text-xs">
              Past ({past.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="space-y-2 mt-0">
            {upcoming.length > 0 ? upcoming.map(renderCard) : (
              <p className="text-center text-xs text-muted-foreground py-6">No upcoming events</p>
            )}
          </TabsContent>
          <TabsContent value="past" className="space-y-2 mt-0">
            {past.length > 0 ? past.map(renderCard) : (
              <p className="text-center text-xs text-muted-foreground py-6">No past events</p>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      <EventDetailDialog
        eventId={openEventId}
        open={!!openEventId}
        onOpenChange={(o) => !o && setOpenEventId(null)}
      />
    </>
  );
}
