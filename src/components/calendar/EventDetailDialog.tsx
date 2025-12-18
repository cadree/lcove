import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarEvent, useEventWithRSVP, useRSVP } from "@/hooks/useCalendar";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Users, 
  Ticket, 
  Coins, 
  Bell, 
  BellOff,
  Check,
  X,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EventDetailDialogProps {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDetailDialog({ eventId, open, onOpenChange }: EventDetailDialogProps) {
  const { user } = useAuth();
  const { data: event, isLoading } = useEventWithRSVP(eventId || '');
  const { rsvp, isRsvping, toggleReminder } = useRSVP();
  const [showTicketPurchase, setShowTicketPurchase] = useState(false);

  if (!eventId || isLoading || !event) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-strong border-border/30">
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleRSVP = (status: string) => {
    if (!user) {
      toast.error('Please log in to RSVP');
      return;
    }
    rsvp({ eventId: event.id, status });
  };

  const handleToggleReminder = () => {
    if (!user || !event.user_rsvp) return;
    toggleReminder({ 
      eventId: event.id, 
      enabled: !event.user_rsvp.reminder_enabled 
    });
  };

  const handleBuyTickets = () => {
    if (!user) {
      toast.error('Please log in to purchase tickets');
      return;
    }
    // This would integrate with Stripe
    toast.info('Ticket purchasing coming soon!');
  };

  const getTicketLabel = () => {
    switch (event.ticket_type) {
      case 'free': return 'Free Event';
      case 'paid': return `$${event.ticket_price}`;
      case 'credits': return `${event.credits_price} Credits`;
      case 'hybrid': return `$${event.ticket_price} or ${event.credits_price} Credits`;
      default: return 'Free';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/30 max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Event Image */}
        {event.image_url && (
          <div 
            className="h-48 -mx-6 -mt-6 bg-cover bg-center rounded-t-lg"
            style={{ backgroundImage: `url(${event.image_url})` }}
          />
        )}

        <DialogHeader className="mt-2">
          <DialogTitle className="font-display text-2xl">
            {event.title}
          </DialogTitle>
        </DialogHeader>

        {/* Event Details */}
        <div className="space-y-4">
          {/* Date & Time */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <Calendar className="w-5 h-5 text-primary" />
            <div>
              <p className="text-foreground font-medium">
                {format(new Date(event.start_date), 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-sm">
                {format(new Date(event.start_date), 'h:mm a')}
                {event.end_date && ` - ${format(new Date(event.end_date), 'h:mm a')}`}
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <MapPin className="w-5 h-5 text-primary" />
            <div>
              <p className="text-foreground font-medium">{event.venue || 'TBA'}</p>
              <p className="text-sm">
                {event.city}{event.state ? `, ${event.state}` : ''}
              </p>
            </div>
          </div>

          {/* Attendees */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <p className="text-foreground font-medium">
                {event.rsvp_count} attending
              </p>
              {event.capacity && (
                <p className="text-sm">{event.capacity - (event.rsvp_count || 0)} spots left</p>
              )}
            </div>
          </div>

          {/* Ticket Info */}
          <div className="flex items-center gap-3 text-muted-foreground">
            {event.ticket_type === 'credits' ? (
              <Coins className="w-5 h-5 text-primary" />
            ) : (
              <Ticket className="w-5 h-5 text-primary" />
            )}
            <p className="text-foreground font-medium">{getTicketLabel()}</p>
          </div>

          {/* Description */}
          {event.description && (
            <div className="pt-4 border-t border-border/30">
              <p className="text-muted-foreground whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {/* RSVP Section */}
          <div className="pt-4 border-t border-border/30 space-y-3">
            <p className="text-sm font-medium text-foreground">Your Response</p>
            
            <div className="flex gap-2">
              <Button
                variant={event.user_rsvp?.status === 'going' ? 'default' : 'glass'}
                size="sm"
                onClick={() => handleRSVP('going')}
                disabled={isRsvping}
                className="flex-1"
              >
                <Check className="w-4 h-4 mr-1" />
                Going
              </Button>
              <Button
                variant={event.user_rsvp?.status === 'interested' ? 'default' : 'glass'}
                size="sm"
                onClick={() => handleRSVP('interested')}
                disabled={isRsvping}
                className="flex-1"
              >
                <Clock className="w-4 h-4 mr-1" />
                Interested
              </Button>
              <Button
                variant={event.user_rsvp?.status === 'not_going' ? 'default' : 'glass'}
                size="sm"
                onClick={() => handleRSVP('not_going')}
                disabled={isRsvping}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-1" />
                Can't Go
              </Button>
            </div>

            {/* Reminder Toggle */}
            {event.user_rsvp && (
              <Button
                variant="glass"
                size="sm"
                onClick={handleToggleReminder}
                className="w-full"
              >
                {event.user_rsvp.reminder_enabled ? (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Reminder On
                  </>
                ) : (
                  <>
                    <BellOff className="w-4 h-4 mr-2" />
                    Reminder Off
                  </>
                )}
              </Button>
            )}

            {/* Ticket Purchase */}
            {event.ticket_type !== 'free' && event.user_rsvp?.status === 'going' && !event.user_rsvp?.ticket_purchased && (
              <Button
                variant="default"
                size="lg"
                onClick={handleBuyTickets}
                className="w-full"
              >
                {event.ticket_type === 'credits' ? (
                  <>
                    <Coins className="w-4 h-4 mr-2" />
                    Use {event.credits_price} Credits
                  </>
                ) : (
                  <>
                    <Ticket className="w-4 h-4 mr-2" />
                    Buy Ticket - ${event.ticket_price}
                  </>
                )}
              </Button>
            )}

            {event.user_rsvp?.ticket_purchased && (
              <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-green-500/20 text-green-400">
                <Check className="w-4 h-4" />
                Ticket Purchased
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
