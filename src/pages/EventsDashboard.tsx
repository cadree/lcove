import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  List,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/contexts/AuthContext";
import { useEventDashboard } from "@/hooks/useEventDashboard";
import BottomNav from "@/components/navigation/BottomNav";
import { cn } from "@/lib/utils";

export default function EventsDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { events, isLoading } = useEventDashboard();
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  if (!user) {
    navigate("/auth");
    return null;
  }

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const getEventsForDay = (day: Date) => {
    return events?.filter(event => {
      const eventStart = parseISO(event.start_date);
      const eventEnd = event.end_date ? parseISO(event.end_date) : eventStart;
      return (
        isSameDay(eventStart, day) ||
        isSameDay(eventEnd, day) ||
        (day >= eventStart && day <= eventEnd)
      );
    }) || [];
  };

  const sortedEvents = useMemo(() => {
    return [...(events || [])].sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
  }, [events]);

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
            onClick={() => navigate("/calendar")}
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>

        {/* View Toggle */}
        <div className="px-4 pb-3">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as "calendar" | "list")}
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
          />
        ) : (
          <ListView
            events={sortedEvents}
            onEventClick={(eventId) => navigate(`/dashboard/events/${eventId}`)}
          />
        )}
      </main>

      <BottomNav />
    </div>
  );
}

interface CalendarViewProps {
  currentMonth: Date;
  calendarDays: Date[];
  getEventsForDay: (day: Date) => Array<{
    id: string;
    title: string;
    start_date: string;
    image_url: string | null;
    ticket_type: string;
  }>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onEventClick: (eventId: string) => void;
}

function CalendarView({
  currentMonth,
  calendarDays,
  getEventsForDay,
  onPrevMonth,
  onNextMonth,
  onEventClick,
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
                "min-h-[80px] p-1 rounded-lg border border-border/30 transition-colors",
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
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event.id)}
                    className="w-full text-left"
                  >
                    <div
                      className={cn(
                        "text-[10px] px-1 py-0.5 rounded truncate font-medium",
                        "bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                      )}
                    >
                      {event.title}
                    </div>
                  </button>
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

interface ListViewProps {
  events: Array<{
    id: string;
    title: string;
    start_date: string;
    end_date: string | null;
    image_url: string | null;
    city: string;
    ticket_type: string;
    status: string | null;
  }>;
  onEventClick: (eventId: string) => void;
}

function ListView({ events, onEventClick }: ListViewProps) {
  const now = new Date();

  const upcomingEvents = events.filter((e) => new Date(e.start_date) > now);
  const pastEvents = events.filter((e) => new Date(e.start_date) <= now);

  const EventCard = ({ event }: { event: ListViewProps["events"][0] }) => (
    <button
      onClick={() => onEventClick(event.id)}
      className="w-full text-left p-3 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm hover:bg-muted/30 transition-colors"
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
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{event.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(event.start_date), "EEE, MMM d · h:mm a")}
          </p>
          <p className="text-xs text-muted-foreground">{event.city}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {event.ticket_type}
            </Badge>
            {event.status && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  event.status === "published" && "border-emerald-500/30 text-emerald-500",
                  event.status === "draft" && "border-amber-500/30 text-amber-500",
                  event.status === "cancelled" && "border-destructive/30 text-destructive"
                )}
              >
                {event.status}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  );

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
