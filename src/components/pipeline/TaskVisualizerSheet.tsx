import { format } from "date-fns";
import { Activity, CheckCircle2, Plus, Trash2, Edit3, Archive, TrendingUp, User } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useTaskEvents, TaskEvent } from "@/hooks/useTaskEvents";
import { cn } from "@/lib/utils";

interface TaskVisualizerSheetProps {
  trigger?: React.ReactNode;
}

const eventIcons: Record<string, React.ElementType> = {
  created: Plus,
  completed: CheckCircle2,
  deleted: Trash2,
  updated: Edit3,
  archived: Archive,
};

const eventColors: Record<string, string> = {
  created: "text-blue-500 bg-blue-500/10",
  completed: "text-green-500 bg-green-500/10",
  deleted: "text-red-500 bg-red-500/10",
  updated: "text-amber-500 bg-amber-500/10",
  archived: "text-purple-500 bg-purple-500/10",
};

function EventItem({ event }: { event: TaskEvent }) {
  const Icon = eventIcons[event.event_type] || Activity;
  const colorClass = eventColors[event.event_type] || "text-muted-foreground bg-muted";

  return (
    <div className="flex gap-3 py-2">
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", colorClass)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="capitalize font-medium">{event.event_type}</span>
          {": "}
          <span className="text-muted-foreground">"{event.task_title}"</span>
        </p>
        {event.contact_name && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <User className="w-3 h-3" /> {event.contact_name}
          </p>
        )}
        <p className="text-xs text-muted-foreground/60 mt-0.5">
          {format(new Date(event.created_at), "h:mm a")}
        </p>
      </div>
    </div>
  );
}

function EventGroup({ title, events }: { title: string; events: TaskEvent[] }) {
  if (events.length === 0) return null;
  
  return (
    <div className="mb-6">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        {title}
      </h4>
      <div className="space-y-1 border-l-2 border-border/50 pl-4 ml-4">
        {events.map((event) => (
          <EventItem key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

export function TaskVisualizerSheet({ trigger }: TaskVisualizerSheetProps) {
  const { groupedEvents, stats, isLoading } = useTaskEvents();

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
            <Activity className="w-3 h-3" />
            Activity
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Task Activity
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <p className="text-2xl font-bold text-primary">{stats.completedToday}</p>
              <p className="text-xs text-muted-foreground">Completed today</p>
            </div>
            <div className="p-3 bg-accent/50 rounded-lg">
              <p className="text-2xl font-bold text-accent-foreground">{stats.completedThisWeek}</p>
              <p className="text-xs text-muted-foreground">This week</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{stats.createdThisWeek}</p>
              <p className="text-xs text-muted-foreground">Created this week</p>
            </div>
            {stats.mostActiveContact && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-semibold truncate">{stats.mostActiveContact.name}</p>
                <p className="text-xs text-muted-foreground">
                  Most active ({stats.mostActiveContact.count} tasks)
                </p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <ScrollArea className="h-[calc(100vh-320px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <EventGroup title="Today" events={groupedEvents.today} />
                <EventGroup title="Yesterday" events={groupedEvents.yesterday} />
                <EventGroup title="Earlier this week" events={groupedEvents.thisWeek} />
                <EventGroup title="Older" events={groupedEvents.older} />
                
                {groupedEvents.today.length === 0 && 
                 groupedEvents.yesterday.length === 0 && 
                 groupedEvents.thisWeek.length === 0 &&
                 groupedEvents.older.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No task activity yet</p>
                    <p className="text-xs mt-1">Complete some tasks to see your progress here!</p>
                  </div>
                )}
              </>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
