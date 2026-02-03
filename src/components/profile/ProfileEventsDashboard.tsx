import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from "date-fns";
import {
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
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useEventDashboard } from "@/hooks/useEventDashboard";
import { CreateCommunityEventDialog } from "@/components/calendar/CreateCommunityEventDialog";
import { CalendarFeedSettings } from "@/components/calendar/CalendarFeedSettings";
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

export function ProfileEventsDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { events, rsvps, isLoading } = useEventDashboard();
  const [view, setView] = useState<"calendar" | "list" | "settings">("list");
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
    if (!user) return;
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

  if (!user) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-5 py-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">My Events</h3>
            <p className="text-xs text-muted-foreground">{events?.length || 0} events</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
            size="sm"
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard/events')}
            className="gap-1"
          >
            Full View
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* View Toggle */}
      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(v) => v && setView(v as "calendar" | "list" | "settings")}
        className="justify-start"
      >
        <ToggleGroupItem value="list" aria-label="List view" className="gap-2 text-xs">
          <List className="h-3.5 w-3.5" />
          List
        </ToggleGroupItem>
        <ToggleGroupItem value="calendar" aria-label="Calendar view" className="gap-2 text-xs">
          <Calendar className="h-3.5 w-3.5" />
          Calendar
        </ToggleGroupItem>
        <ToggleGroupItem value="settings" aria-label="Settings" className="gap-2 text-xs">
          <Rss className="h-3.5 w-3.5" />
          Feed
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Content */}
      <Card className="p-3 bg-card/60 border-border/40">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : view === "calendar" ? (
          <CompactCalendarView
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
          <CompactListView
            events={sortedEvents}
            onEventClick={(eventId) => navigate(`/dashboard/events/${eventId}`)}
            onEdit={(eventId) => navigate(`/dashboard/events/${eventId}`)}
            onShare={handleShare}
            onDuplicate={handleDuplicate}
          />
        ) : (
          <CalendarFeedSettings />
        )}
      </Card>

      <CreateCommunityEventDialog 
        open={showCreateDialog} 
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ['dashboard-events'] });
            queryClient.invalidateQueries({ queryKey: ['events'] });
          }
        }}
      />
    </motion.div>
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

interface CompactCalendarViewProps {
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

function CompactCalendarView({
  currentMonth,
  calendarDays,
  getEventsForDay,
  onPrevMonth,
  onNextMonth,
  onEventClick,
}: CompactCalendarViewProps) {
  const today = new Date();
  const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="space-y-3">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onPrevMonth} className="h-7 w-7">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
        <Button variant="ghost" size="icon" onClick={onNextMonth} className="h-7 w-7">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-0.5">
        {weekDays.map((day, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-medium text-muted-foreground py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, today);
          const hasEvents = dayEvents.length > 0;

          return (
            <button
              key={index}
              onClick={() => hasEvents && onEventClick(dayEvents[0].id)}
              className={cn(
                "aspect-square flex flex-col items-center justify-center rounded-md text-xs transition-colors",
                isCurrentMonth ? "text-foreground" : "text-muted-foreground/50",
                isToday && "ring-1 ring-primary bg-primary/10",
                hasEvents && "bg-primary/20 font-medium",
                hasEvents && "hover:bg-primary/30 cursor-pointer"
              )}
            >
              {format(day, "d")}
              {hasEvents && (
                <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface CompactListViewProps {
  events: EventWithStats[];
  onEventClick: (eventId: string) => void;
  onEdit: (eventId: string) => void;
  onShare: (event: EventWithStats) => void;
  onDuplicate: (event: EventWithStats) => void;
}

function CompactListView({ events, onEventClick, onEdit, onShare, onDuplicate }: CompactListViewProps) {
  if (events.length === 0) {
    return (
      <div className="py-8 text-center">
        <CalendarDays className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No events yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Create your first event to get started</p>
      </div>
    );
  }

  // Show only first 5 events in compact view
  const displayEvents = events.slice(0, 5);

  return (
    <div className="space-y-2">
      {displayEvents.map((event) => {
        const status = getEventDisplayStatus(event);
        const totalCount = (event.rsvpCount || 0) + (event.ticketCount || 0);

        return (
          <div
            key={event.id}
            className="flex items-center gap-3 p-2 rounded-lg border border-border/30 bg-background/50 hover:bg-muted/50 transition-colors"
          >
            <button
              onClick={() => onEventClick(event.id)}
              className="flex-1 flex items-center gap-3 text-left"
            >
              {event.image_url ? (
                <img
                  src={event.image_url}
                  alt=""
                  className="w-10 h-10 rounded-md object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{event.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(event.start_date), "MMM d")}
                  </span>
                  <Badge variant="outline" className={cn("text-[9px] px-1 py-0", statusColors[status.variant])}>
                    {status.label}
                  </Badge>
                  {totalCount > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <Users className="h-3 w-3" />
                      {totalCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1.5" align="end">
                <button
                  onClick={() => onEdit(event.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => onShare(event)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </button>
                <button
                  onClick={() => onDuplicate(event)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate
                </button>
              </PopoverContent>
            </Popover>
          </div>
        );
      })}
      {events.length > 5 && (
        <p className="text-xs text-center text-muted-foreground pt-1">
          +{events.length - 5} more events
        </p>
      )}
    </div>
  );
}
