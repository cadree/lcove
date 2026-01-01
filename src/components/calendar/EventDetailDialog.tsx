import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarEvent, useEventWithRSVP, useRSVP, useCreatePersonalItem } from "@/hooks/useCalendar";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
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
  Share2,
  CalendarPlus,
  Copy,
  Twitter,
  ExternalLink,
  Loader2,
  Navigation,
  FolderOpen,
  User,
  Settings,
  Sun,
  CalendarCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EventAttendeesDialog } from "./EventAttendeesDialog";

interface EventDetailDialogProps {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDetailDialog({ eventId, open, onOpenChange }: EventDetailDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: event, isLoading, refetch } = useEventWithRSVP(eventId || '');
  const { rsvp, isRsvping, toggleReminder } = useRSVP();
  const creditsData = useCredits();
  const { isAddedToMyDay, addEventToMyDay, removeByReference } = useCalendarTasks();
  const createPersonalItem = useCreatePersonalItem();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [isAddingToMyDay, setIsAddingToMyDay] = useState(false);
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);

  const isCreator = user?.id === event?.creator_id;

  if (!eventId || isLoading || !event) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-strong border-border/30">
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const spotsLeft = event.capacity ? event.capacity - (event.rsvp_count || 0) : null;
  const isSoldOut = spotsLeft !== null && spotsLeft <= 0;
  const eventDate = new Date(event.start_date);
  const isUpcoming = eventDate > new Date();
  const timeUntilEvent = isUpcoming ? formatDistanceToNow(eventDate, { addSuffix: true }) : null;

  const handleRSVP = async (status: string) => {
    if (!user) {
      toast.error('Please log in to RSVP');
      return;
    }
    rsvp({ eventId: event.id, status });
    
    // If marking as interested, also enable reminder and create a notification
    if (status === 'interested') {
      try {
        // Create an event reminder notification
        await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            type: 'event_reminder',
            title: 'Event Interest Noted',
            body: `You're interested in "${event.title}"`,
            data: { event_id: event.id },
          });
      } catch (err) {
        console.error('Error creating notification:', err);
      }
    }
  };

  const handleToggleReminder = async () => {
    if (!user || !event.user_rsvp) return;
    const newEnabled = !event.user_rsvp.reminder_enabled;
    toggleReminder({ 
      eventId: event.id, 
      enabled: newEnabled 
    });
    
    // Create or remove notification based on reminder preference
    try {
      if (newEnabled) {
        // Add event reminder notification
        await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            type: 'event_reminder',
            title: 'Reminder Set',
            body: `You'll be reminded about "${event.title}"`,
            data: { event_id: event.id },
          });
      }
    } catch (err) {
      console.error('Error managing reminder notification:', err);
    }
  };

  const handleNotifyMe = async () => {
    if (!user) {
      toast.error('Please log in to get notified');
      return;
    }
    // If not RSVPed, set as interested with reminder
    if (!event.user_rsvp) {
      rsvp({ eventId: event.id, status: 'interested' });
      
      // Create notification for the event
      try {
        await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            type: 'event_reminder',
            title: 'Event Reminder Set',
            body: `You'll be notified about "${event.title}"`,
            data: { event_id: event.id },
          });
      } catch (err) {
        console.error('Error creating notification:', err);
      }
      
      toast.success('You will be notified about this event');
    }
  };

  const handleBuyTickets = async () => {
    if (!user) {
      toast.error('Please log in to purchase tickets');
      return;
    }

    if (isSoldOut) {
      toast.error('This event is sold out');
      return;
    }

    setIsPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke('purchase-event-ticket', {
        body: {
          eventId: event.id,
          eventTitle: event.title,
          ticketPrice: event.ticket_price,
          quantity: 1,
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      console.log('Checkout response:', data);

      if (data?.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Error purchasing ticket:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleUseCredits = async () => {
    if (!user) {
      toast.error('Please log in to use credits');
      return;
    }

    if (creditsData.balance < (event.credits_price || 0)) {
      toast.error('Insufficient credits');
      return;
    }

    setIsPurchasing(true);
    try {
      // Mark ticket as purchased using credits
      const { error } = await supabase
        .from('event_rsvps')
        .update({ 
          ticket_purchased: true, 
          credits_spent: event.credits_price 
        })
        .eq('event_id', event.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Deduct credits via the edge function
      await supabase.functions.invoke('award-credits', {
        body: {
          userId: user.id,
          amount: -(event.credits_price || 0),
          description: `Ticket purchase: ${event.title}`,
          referenceType: 'event_ticket',
          referenceId: event.id
        }
      });

      toast.success('Ticket purchased with credits!');
      refetch();
    } catch (error) {
      console.error('Error using credits:', error);
      toast.error('Failed to purchase ticket');
    } finally {
      setIsPurchasing(false);
    }
  };

  const generateCalendarUrl = (type: 'google' | 'apple' | 'outlook') => {
    const startDate = new Date(event.start_date);
    const endDate = event.end_date ? new Date(event.end_date) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    
    const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d{3}/g, '');
    
    const title = encodeURIComponent(event.title);
    const location = encodeURIComponent(`${event.venue || ''}, ${event.city}${event.state ? `, ${event.state}` : ''}`);
    const details = encodeURIComponent(event.description || '');

    if (type === 'google') {
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDate(startDate)}/${formatDate(endDate)}&location=${location}&details=${details}`;
    }
    
    if (type === 'outlook') {
      return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&location=${location}&body=${details}`;
    }

    // Apple Calendar uses ICS format
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${event.title}
LOCATION:${event.venue || ''}, ${event.city}
DESCRIPTION:${event.description || ''}
END:VEVENT
END:VCALENDAR`;
    
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
  };

  const handleAddToCalendar = (type: 'google' | 'apple' | 'outlook') => {
    const url = generateCalendarUrl(type);
    
    if (type === 'apple') {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${event.title.replace(/\s+/g, '-')}.ics`;
      link.click();
    } else {
      window.open(url, '_blank');
    }
    
    toast.success('Opening calendar...');
  };

  const handleShare = async (method: 'copy' | 'twitter' | 'native') => {
    const eventUrl = `${window.location.origin}/calendar?event=${event.id}`;
    const shareText = `Check out "${event.title}" on ${format(eventDate, 'MMMM d')}!`;

    if (method === 'copy') {
      await navigator.clipboard.writeText(eventUrl);
      toast.success('Link copied to clipboard!');
    } else if (method === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(eventUrl)}`, '_blank');
    } else if (method === 'native' && navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: shareText,
          url: eventUrl,
        });
      } catch (err) {
        // User cancelled or error
      }
    }
  };

  const handleGetDirections = () => {
    const address = encodeURIComponent(`${event.venue || ''} ${event.address || ''} ${event.city} ${event.state || ''}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
  };

  const getTicketLabel = () => {
    switch (event.ticket_type) {
      case 'free': return 'Free Event';
      case 'paid': return `$${event.ticket_price}`;
      case 'credits': return `${event.credits_price} Credits`;
      case 'hybrid': return `$${event.ticket_price} or ${event.credits_price} Credits`;
      case 'info': return 'Info Only';
      default: return 'Free';
    }
  };

  const handleLearnMore = () => {
    if (event.external_url) {
      window.open(event.external_url, '_blank');
    }
  };

  const handleViewProject = () => {
    if (event.project_id) {
      onOpenChange(false);
      navigate(`/projects?id=${event.project_id}`);
    }
  };

  const handleViewOrganizer = () => {
    if (event.creator_id) {
      onOpenChange(false);
      navigate(`/profile/${event.creator_id}`);
    }
  };

  const isEventInMyDay = isAddedToMyDay(event.id);

  const handleAddToMyDay = async () => {
    if (!user) {
      toast.error('Please log in to add to My Day');
      return;
    }
    
    setIsAddingToMyDay(true);
    try {
      if (isEventInMyDay) {
        await removeByReference.mutateAsync({ eventId: event.id });
        toast.success('Removed from My Day');
      } else {
        await addEventToMyDay.mutateAsync({
          eventId: event.id,
          title: event.title,
          dueAt: event.start_date,
        });
        toast.success('Added to My Day!');
      }
    } catch (error) {
      toast.error('Failed to update My Day');
    } finally {
      setIsAddingToMyDay(false);
    }
  };

  const handleAddToPersonalCalendar = async () => {
    if (!user) {
      toast.error('Please log in to add to calendar');
      return;
    }
    
    setIsAddingToCalendar(true);
    try {
      await createPersonalItem.mutateAsync({
        title: event.title,
        description: event.description || null,
        location: event.venue ? `${event.venue}, ${event.city}` : event.city,
        start_date: event.start_date,
        end_date: event.end_date || null,
        all_day: false,
        color: null,
        reminder_minutes: 60,
      });
      toast.success('Added to your personal calendar!');
    } catch (error) {
      toast.error('Failed to add to calendar');
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  const handleAttendEvent = () => {
    if (!user) {
      toast.error('Please log in to RSVP');
      return;
    }
    // RSVP as going
    rsvp({ eventId: event.id, status: 'going' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/30 max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {/* Event Image */}
        {event.image_url && (
          <div 
            className="h-56 bg-cover bg-center relative"
            style={{ backgroundImage: `url(${event.image_url})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
            
            {/* Floating badges */}
            <div className="absolute top-4 right-4 flex gap-2">
              {isSoldOut && (
                <span className="px-3 py-1 rounded-full bg-destructive/90 text-destructive-foreground text-xs font-medium">
                  Sold Out
                </span>
              )}
              {timeUntilEvent && (
                <span className="px-3 py-1 rounded-full bg-background/80 backdrop-blur text-foreground text-xs font-medium">
                  {timeUntilEvent}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="p-6 space-y-5">
          <DialogHeader className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="font-display text-2xl leading-tight">
                {event.title}
              </DialogTitle>
              
              {/* Quick Actions */}
              <div className="flex gap-1 shrink-0">
                {/* Add to Calendar */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <CalendarPlus className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-strong border-border/30">
                    <DropdownMenuItem onClick={() => handleAddToCalendar('google')}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Google Calendar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddToCalendar('apple')}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Apple Calendar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddToCalendar('outlook')}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Outlook
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Share */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-strong border-border/30">
                    <DropdownMenuItem onClick={() => handleShare('copy')}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleShare('twitter')}>
                      <Twitter className="w-4 h-4 mr-2" />
                      Share on Twitter
                    </DropdownMenuItem>
                    {navigator.share && (
                      <DropdownMenuItem onClick={() => handleShare('native')}>
                        <Share2 className="w-4 h-4 mr-2" />
                        Share...
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            {/* Ticket type badge */}
            <div className="flex items-center gap-2">
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium",
                event.ticket_type === 'free' ? "bg-green-500/20 text-green-400" : "",
                event.ticket_type === 'paid' ? "bg-primary/20 text-primary" : "",
                event.ticket_type === 'credits' ? "bg-accent/50 text-accent-foreground" : "",
                event.ticket_type === 'hybrid' ? "bg-primary/20 text-primary" : ""
              )}>
                {event.ticket_type === 'credits' ? (
                  <Coins className="w-3 h-3" />
                ) : (
                  <Ticket className="w-3 h-3" />
                )}
                {getTicketLabel()}
              </span>
            </div>
          </DialogHeader>

          {/* Event Details */}
          <div className="space-y-4">
            {/* Date & Time */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-medium">
                  {format(eventDate, 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(eventDate, 'h:mm a')}
                  {event.end_date && ` - ${format(new Date(event.end_date), 'h:mm a')}`}
                </p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-foreground font-medium">{event.venue || 'Location TBA'}</p>
                <p className="text-sm text-muted-foreground">
                  {event.city}{event.state ? `, ${event.state}` : ''}
                </p>
                {event.venue && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-primary"
                    onClick={handleGetDirections}
                  >
                    <Navigation className="w-3 h-3 mr-1" />
                    Get Directions
                  </Button>
                )}
              </div>
            </div>

            {/* Attendees */}
            <div 
              className={cn(
                "flex items-start gap-3",
                isCreator && "cursor-pointer hover:bg-accent/20 -mx-3 px-3 py-2 rounded-xl transition-colors"
              )}
              onClick={() => isCreator && setAttendeesOpen(true)}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-foreground font-medium">
                  {event.rsvp_count} attending
                </p>
                {spotsLeft !== null && (
                  <p className={cn(
                    "text-sm",
                    spotsLeft <= 10 ? "text-primary" : "text-muted-foreground"
                  )}>
                    {isSoldOut ? 'Sold out' : `${spotsLeft} spots left`}
                  </p>
                )}
                {isCreator && (
                  <p className="text-xs text-primary mt-1">Tap to manage attendees</p>
                )}
              </div>
              {isCreator && <Settings className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
            </div>

            {/* Organizer */}
            <div 
              className="flex items-start gap-3 cursor-pointer hover:bg-accent/20 -mx-3 px-3 py-2 rounded-xl transition-colors"
              onClick={handleViewOrganizer}
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={event.organizer?.avatar_url || ''} />
                <AvatarFallback className="bg-primary/20 text-primary">
                  <User className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-foreground font-medium">
                  {event.organizer?.display_name || 'Event Organizer'}
                </p>
                <p className="text-sm text-muted-foreground">Host</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="pt-4 border-t border-border/30">
              <h4 className="text-sm font-medium text-foreground mb-2">About this event</h4>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {/* Project Link */}
          {event.project_id && (
            <div className="pt-4 border-t border-border/30">
              <Button
                variant="glass"
                size="sm"
                onClick={handleViewProject}
                className="w-full"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                View Associated Project
              </Button>
            </div>
          )}

          {/* Actions Section */}
          <div className="pt-4 border-t border-border/30 space-y-4">
            {/* Primary Action based on ticket type */}
            {event.ticket_type === 'free' && (
              <Button
                variant={event.user_rsvp?.status === 'going' ? 'glass' : 'default'}
                size="lg"
                onClick={() => handleRSVP(event.user_rsvp?.status === 'going' ? 'cancelled' : 'going')}
                disabled={isRsvping || isSoldOut}
                className="w-full"
              >
                {isRsvping ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : event.user_rsvp?.status === 'going' ? (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    Cancel RSVP
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    RSVP Free
                  </>
                )}
              </Button>
            )}

            {event.ticket_type === 'info' && event.external_url && (
              <Button
                variant="default"
                size="lg"
                onClick={handleLearnMore}
                className="w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Learn More
              </Button>
            )}

            {/* Paid Ticket Purchase */}
            {(event.ticket_type === 'paid' || event.ticket_type === 'hybrid') && !event.user_rsvp?.ticket_purchased && !isSoldOut && (
              <div className="space-y-2">
                {event.external_url ? (
                  <Button
                    variant="default"
                    size="lg"
                    onClick={handleLearnMore}
                    className="w-full"
                  >
                    <Ticket className="w-4 h-4 mr-2" />
                    Buy Ticket - ${event.ticket_price}
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="lg"
                    onClick={handleBuyTickets}
                    disabled={isPurchasing}
                    className="w-full"
                  >
                    {isPurchasing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Ticket className="w-4 h-4 mr-2" />
                    )}
                    Buy Ticket - ${event.ticket_price}
                  </Button>
                )}
                
                {(event.ticket_type === 'hybrid') && (
                  <Button
                    variant="glass"
                    size="default"
                    onClick={handleUseCredits}
                    disabled={isPurchasing || creditsData.balance < (event.credits_price || 0)}
                    className="w-full"
                  >
                    {isPurchasing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Coins className="w-4 h-4 mr-2" />
                    )}
                    Use {event.credits_price} Credits
                    <span className="ml-2 text-xs opacity-70">
                      (Balance: {creditsData.balance})
                    </span>
                  </Button>
                )}
              </div>
            )}

            {/* Credits only ticket */}
            {event.ticket_type === 'credits' && !event.user_rsvp?.ticket_purchased && !isSoldOut && (
              <Button
                variant="default"
                size="lg"
                onClick={handleUseCredits}
                disabled={isPurchasing || creditsData.balance < (event.credits_price || 0)}
                className="w-full"
              >
                {isPurchasing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Coins className="w-4 h-4 mr-2" />
                )}
                Use {event.credits_price} Credits
                <span className="ml-2 text-xs opacity-70">
                  (Balance: {creditsData.balance})
                </span>
              </Button>
            )}

            {/* Ticket Purchased Confirmation */}
            {event.user_rsvp?.ticket_purchased && (
              <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-green-500/20 text-green-400">
                <Check className="w-5 h-5" />
                <span className="font-medium">Ticket Secured!</span>
              </div>
            )}

            {/* RSVP Status Row for non-free events */}
            {event.ticket_type !== 'free' && event.ticket_type !== 'info' && (
              <div>
                <p className="text-sm font-medium text-foreground mb-3">Interested?</p>
                <div className="flex gap-2">
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
              </div>
            )}

            {/* Notify Me / Reminder */}
            {event.ticket_type !== 'info' && (
              !event.user_rsvp ? (
                <Button
                  variant="glass"
                  size="sm"
                  onClick={handleNotifyMe}
                  className="w-full"
                  role="button"
                  aria-label="Get notified about this event"
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Notify Me About This Event
                </Button>
              ) : (
                <Button
                  variant="glass"
                  size="sm"
                  onClick={handleToggleReminder}
                  className="w-full"
                  role="button"
                  aria-label={event.user_rsvp.reminder_enabled ? "Turn off reminder" : "Turn on reminder"}
                >
                  {event.user_rsvp.reminder_enabled ? (
                    <>
                      <Bell className="w-4 h-4 mr-2 text-primary" />
                      Reminder On
                    </>
                  ) : (
                    <>
                      <BellOff className="w-4 h-4 mr-2" />
                      Reminder Off
                    </>
                  )}
                </Button>
              )
            )}

            {/* Quick Actions Row */}
            <div className="flex gap-2 pt-2">
              {/* Add to My Day */}
              <Button
                variant={isEventInMyDay ? "default" : "glass"}
                size="sm"
                onClick={handleAddToMyDay}
                disabled={isAddingToMyDay}
                className="flex-1"
                role="button"
                aria-label={isEventInMyDay ? "Remove from My Day" : "Add to My Day"}
              >
                {isAddingToMyDay ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Sun className={cn("w-4 h-4 mr-1", isEventInMyDay && "text-amber-500")} />
                )}
                {isEventInMyDay ? "In My Day" : "Add to My Day"}
              </Button>

              {/* Add to Personal Calendar */}
              <Button
                variant="glass"
                size="sm"
                onClick={handleAddToPersonalCalendar}
                disabled={isAddingToCalendar}
                className="flex-1"
                role="button"
                aria-label="Save to personal calendar"
              >
                {isAddingToCalendar ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <CalendarCheck className="w-4 h-4 mr-1" />
                )}
                Save to Calendar
              </Button>
            </div>

            {/* I'm Attending button for quick RSVP */}
            {event.ticket_type === 'free' && !event.user_rsvp?.status?.includes('going') && !isSoldOut && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAttendEvent}
                disabled={isRsvping}
                className="w-full border-green-500/50 text-green-500 hover:bg-green-500/10"
                role="button"
                aria-label="Mark as attending"
              >
                {isRsvping ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                I'm Attending
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Attendees Management Dialog */}
      {event && (
        <EventAttendeesDialog
          eventId={event.id}
          eventTitle={event.title}
          open={attendeesOpen}
          onOpenChange={setAttendeesOpen}
        />
      )}
    </Dialog>
  );
}
