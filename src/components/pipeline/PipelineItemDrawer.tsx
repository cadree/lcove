import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, ArrowRight, PlusCircle, StickyNote } from "lucide-react";
import { PipelineItem, PipelineEvent } from "@/actions/pipelineActions";

interface PipelineItemDrawerProps {
  item: PipelineItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getEventsForItem: (itemId: string) => PipelineEvent[];
}

export function PipelineItemDrawer({ item, open, onOpenChange, getEventsForItem }: PipelineItemDrawerProps) {
  if (!item) return null;

  const events = getEventsForItem(item.id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-left text-xl">{item.title}</SheetTitle>
          {item.subtitle && (
            <p className="text-muted-foreground text-sm text-left">{item.subtitle}</p>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] pr-4">
          {/* Notes Section */}
          {item.notes && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-medium text-sm text-foreground">Notes</h3>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap">
                {item.notes}
              </div>
            </div>
          )}

          <Separator className="my-4" />

          {/* Timeline Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium text-sm text-foreground">Activity Timeline</h3>
            </div>

            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <TimelineEvent key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>

          {/* Created At */}
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Created {format(new Date(item.created_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

interface TimelineEventProps {
  event: PipelineEvent;
}

function TimelineEvent({ event }: TimelineEventProps) {
  const getEventIcon = () => {
    switch (event.type) {
      case 'created':
        return <PlusCircle className="w-4 h-4 text-green-500" />;
      case 'stage_changed':
        return <ArrowRight className="w-4 h-4 text-blue-500" />;
      case 'note_added':
        return <StickyNote className="w-4 h-4 text-amber-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getEventLabel = () => {
    switch (event.type) {
      case 'created':
        return 'Item created';
      case 'stage_changed':
        return 'Moved to new stage';
      case 'note_added':
        return 'Note added';
      default:
        return event.type;
    }
  };

  const getEventBadgeVariant = (): "default" | "secondary" | "outline" => {
    switch (event.type) {
      case 'created':
        return 'default';
      case 'stage_changed':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 mt-0.5">
        {getEventIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={getEventBadgeVariant()} className="text-xs">
            {getEventLabel()}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {format(new Date(event.created_at), "MMM d, h:mm a")}
          </span>
        </div>
        {event.type === 'note_added' && event.data?.note && (
          <p className="text-sm text-muted-foreground mt-1 truncate">
            "{String(event.data.note)}"
          </p>
        )}
      </div>
    </div>
  );
}
