import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  List,
  ChevronLeft,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Edit,
  Share2,
  Copy,
  Users,
  Rss,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { useEventDashboard } from "@/hooks/useEventDashboard";
import { CreateCommunityEventDialog } from "@/components/calendar/CreateCommunityEventDialog";
import { CalendarFeedSettings } from "@/components/calendar/CalendarFeedSettings";
import BottomNav from "@/components/navigation/BottomNav";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface EventWithStats {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  image_url: string | null;
  ticket_type: string;
  status: string | null;
  city: string;
  rsvpCount?: number;
  ticketCount?: number;
}

export default function EventsDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { events, rsvps, isLoading } = useEventDashboard();
  const [view, setView] = useState<"calendar" | "list" | "settings">("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Enrich events with RSVP/ticket counts
  const eventsWithStats: EventWithStats[] = useMemo(() => {
    return (events || []).map(event => {
      const eventRsvps = rsvps?.filter(r => r.event_id === event.id) || [];
      return {
        ...event,
        rsvpCount: eventRsvps.filter(r => r.status === 'going' || r.status === 'interested').length,
        ticketCount: eventRsvps.filter(r => r.ticket_purchased).length,
      };
    });
  }, [events, rsvps]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const getEventsForDay = (day: Date): EventWithStats[] => {
    return eventsWithStats.filter(event => {
      const eventStart = parseISO(event.start_date);
      const eventEnd = event.end_date ? parseISO(event.end_date) : eventStart;
      return (
        isSameDay(eventStart, day) ||
        isSameDay(eventEnd, day) ||
        (day >= eventStart && day <= eventEnd)
      );
    });
  };

  const sortedEvents = useMemo(() => {
    return [...eventsWithStats].sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
  }, [eventsWithStats]);

  const handleShare = async (event: EventWithStats) => {
    const url = `${window.location.origin}/calendar?event=${event.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: `Check out this event: ${event.title}`,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  const handleDuplicate = async (event: EventWithStats) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          title: `${event.title} (Copy)`,
          start_date: event.start_date,
          end_date: event.end_date,
          image_url: event.image_url,
          ticket_type: event.ticket_type,
          city: event.city,
          status: 'draft',
          creator_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Event duplicated!");
      navigate(`/dashboard/events/${data.id}`);
    } catch (error) {
      console.error('Duplicate error:', error);
      toast.error("Failed to duplicate event");
    }
  };

  // Auth check after all hooks
  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-background/95 border-b border-border/30"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0px)" }}
      >
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-display font-semibold">My Events</h1>
              <p className="text-xs text-muted-foreground">{events?.length || 0} events</p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>

        {/* View Toggle + Settings */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as "calendar" | "list" | "settings")}
            className="justify-start"
          >
            <ToggleGroupItem value="calendar" aria-label="Calendar view" className="gap-2">
              <Calendar className="h-4 w-4" />
              Calendar
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="gap-2">
              <List className="h-4 w-4" />
              List
            </ToggleGroupItem>
            <ToggleGroupItem value="settings" aria-label="Settings" className="gap-2">
              <Rss className="h-4 w-4" />
              Feed
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </motion.header>

      <main className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : view === "calendar" ? (
          <CalendarView
            currentMonth={currentMonth}
            calendarDays={calendarDays}
            getEventsForDay={getEventsForDay}
            onPrevMonth={() => setCurrentMonth(subMonths(currentMonth, 1))}
            onNextMonth={() => setCurrentMonth(addMonths(currentMonth, 1))}
            onEventClick={(eventId) => navigate(`/dashboard/events/${eventId}`)}
            onEdit={(eventId) => navigate(`/dashboard/events/${eventId}`)}
            onShare={handleShare}
            onDuplicate={handleDuplicate}
          />
        ) : view === "list" ? (
          <ListView
            events={sortedEvents}
            onEventClick={(eventId) => navigate(`/dashboard/events/${eventId}`)}
            onEdit={(eventId) => navigate(`/dashboard/events/${eventId}`)}
            onShare={handleShare}
            onDuplicate={handleDuplicate}
          />
        ) : (
          <CalendarFeedSettings />
        )}
      </main>

      <CreateCommunityEventDialog 
        open={showCreateDialog} 
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            // Refresh dashboard data when dialog closes
            queryClient.invalidateQueries({ queryKey: ['dashboard-events'] });
            queryClient.invalidateQueries({ queryKey: ['events'] });
          }
        }}
      />

      <BottomNav />
    </div>
  );
}

// Helper to get display status
function getEventDisplayStatus(event: EventWithStats): { label: string; variant: 'draft' | 'live' | 'ended' | 'cancelled' } {
  const now = new Date();
  const start = new Date(event.start_date);
  const end = event.end_date ? new Date(event.end_date) : start;

  if (event.status === 'cancelled') return { label: 'Cancelled', variant: 'cancelled' };
  if (event.status === 'draft') return { label: 'Draft', variant: 'draft' };
  if (now > end) return { label: 'Ended', variant: 'ended' };
  if (now >= start && now <= end) return { label: 'Live', variant: 'live' };
  return { label: 'Upcoming', variant: 'live' };
}

const statusColors = {
  draft: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
  live: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
  ended: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-destructive/20 text-destructive border-destructive/30',
};

interface CalendarViewProps {
  currentMonth: Date;
  calendarDays: Date[];
  getEventsForDay: (day: Date) => EventWithStats[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onEventClick: (eventId: string) => void;
  onEdit: (eventId: string) => void;
  onShare: (event: EventWithStats) => void;
  onDuplicate: (event: EventWithStats) => void;
}

function CalendarView({
  currentMonth,
  calendarDays,
  getEventsForDay,
  onPrevMonth,
  onNextMonth,
  onEventClick,
  onEdit,
  onShare,
  onDuplicate,
}: CalendarViewProps) {
  const today = new Date();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onPrevMonth}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
        <Button variant="ghost" size="icon" onClick={onNextMonth}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, today);

          return (
            <div
              key={index}
              className={cn(
                "min-h-[90px] p-1 rounded-lg border border-border/30 transition-colors",
                isCurrentMonth ? "bg-card/60" : "bg-muted/20 opacity-50",
                isToday && "ring-2 ring-primary/50"
              )}
            >
              <div
                className={cn(
                  "text-xs font-medium mb-1",
                  isToday && "text-primary"
                )}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map((event) => (
                  <EventBlock
                    key={event.id}
                    event={event}
                    onClick={() => onEventClick(event.id)}
                    onEdit={() => onEdit(event.id)}
                    onShare={() => onShare(event)}
                    onDuplicate={() => onDuplicate(event)}
                  />
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[9px] text-muted-foreground px-1">
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface EventBlockProps {
  event: EventWithStats;
  onClick: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDuplicate: () => void;
}

function EventBlock({ event, onClick, onEdit, onShare, onDuplicate }: EventBlockProps) {
  const status = getEventDisplayStatus(event);
  const totalCount = (event.rsvpCount || 0) + (event.ticketCount || 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="w-full text-left group">
          <div
            className={cn(
              "text-[10px] px-1.5 py-1 rounded border transition-colors",
              "bg-primary/10 border-primary/20 hover:bg-primary/20"
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-medium truncate flex-1">{event.title}</span>
              <MoreHorizontal className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0" />
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span
                className={cn(
                  "text-[8px] px-1 py-0 rounded border",
                  statusColors[status.variant]
                )}
              >
                {status.label}
              </span>
              {totalCount > 0 && (
                <span className="text-[8px] text-muted-foreground flex items-center gap-0.5">
                  <Users className="h-2 w-2" />
                  {totalCount}
                </span>
              )}
            </div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1">
          <p className="text-sm font-medium truncate px-2 py-1">{event.title}</p>
          <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
            <Badge variant="outline" className={cn("text-[10px]", statusColors[status.variant])}>
              {status.label}
            </Badge>
            {totalCount > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {event.ticketCount || 0} tickets · {event.rsvpCount || 0} RSVPs
              </span>
            )}
          </div>
          <div className="border-t border-border my-1" />
          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
          >
            View Details
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
          >
            <Edit className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ListViewProps {
  events: EventWithStats[];
  onEventClick: (eventId: string) => void;
  onEdit: (eventId: string) => void;
  onShare: (event: EventWithStats) => void;
  onDuplicate: (event: EventWithStats) => void;
}

function ListView({ events, onEventClick, onEdit, onShare, onDuplicate }: ListViewProps) {
  const now = new Date();

  const upcomingEvents = events.filter((e) => new Date(e.start_date) > now);
  const pastEvents = events.filter((e) => new Date(e.start_date) <= now);

  const EventCard = ({ event }: { event: EventWithStats }) => {
    const status = getEventDisplayStatus(event);
    const totalCount = (event.rsvpCount || 0) + (event.ticketCount || 0);

    return (
      <div className="relative p-3 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm">
        <button
          onClick={() => onEventClick(event.id)}
          className="w-full text-left"
        >
          <div className="flex gap-3">
            {event.image_url ? (
              <img
                src={event.image_url}
                alt={event.title}
                className="w-16 h-16 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0 pr-8">
              <h3 className="font-medium text-sm truncate">{event.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(event.start_date), "EEE, MMM d · h:mm a")}
              </p>
              <p className="text-xs text-muted-foreground">{event.city}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn("text-[10px] px-1.5 py-0", statusColors[status.variant])}
                >
                  {status.label}
                </Badge>
                {totalCount > 0 && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {event.ticketCount || 0} tickets · {event.rsvpCount || 0} RSVPs
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>

        {/* Quick Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(event.id)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShare(event)}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(event)}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No events yet</p>
        <p className="text-xs mt-1">Create your first event to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {upcomingEvents.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Upcoming</h3>
          <div className="space-y-2">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {pastEvents.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Past Events</h3>
          <div className="space-y-2 opacity-75">
            {pastEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
