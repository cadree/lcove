import { useEventMoodboard } from "@/hooks/useEventMoodboard";
import { Clock, ExternalLink, StickyNote } from "lucide-react";
import { format } from "date-fns";

interface Props {
  eventId: string;
}

export function EventMoodboardView({ eventId }: Props) {
  const { data: items = [], isLoading } = useEventMoodboard(eventId);

  if (isLoading || items.length === 0) return null;

  const itinerary = items
    .filter((i) => i.type === 'itinerary' && i.start_time)
    .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());
  const visuals = items.filter((i) => i.type === 'image');
  const notes = items.filter((i) => i.type === 'note');
  const links = items.filter((i) => i.type === 'link');

  return (
    <div className="space-y-5">
      <h2 className="font-display text-lg flex items-center gap-2">
        <span className="inline-block w-1 h-5 bg-primary rounded-full" />
        Vibes & Itinerary
      </h2>

      {itinerary.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Schedule</h3>
          <div className="space-y-2">
            {itinerary.map((item) => (
              <div key={item.id} className="flex gap-3 p-3 rounded-lg bg-card border border-border/50">
                <div className="flex flex-col items-center shrink-0 w-16">
                  <Clock className="h-4 w-4 text-primary mb-1" />
                  <span className="text-xs font-semibold text-primary">
                    {format(new Date(item.start_time!), 'h:mm a')}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(item.start_time!), 'MMM d')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  {item.title && <p className="font-medium text-sm">{item.title}</p>}
                  {item.body && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{item.body}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {visuals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Moodboard</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {visuals.map((item) => (
              <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden border border-border/50">
                <img src={item.media_url!} alt={item.title || ''} className="w-full h-full object-cover" />
                {item.title && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-2">
                    <p className="text-xs text-foreground font-medium truncate">{item.title}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="space-y-2">
          {notes.map((item) => (
            <div key={item.id} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2 mb-1">
                <StickyNote className="h-3.5 w-3.5 text-amber-600" />
                {item.title && <p className="font-medium text-sm">{item.title}</p>}
              </div>
              {item.body && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.body}</p>}
            </div>
          ))}
        </div>
      )}

      {links.length > 0 && (
        <div className="space-y-1.5">
          {links.map((item) => (
            <a
              key={item.id}
              href={item.link_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border/50 hover:border-primary/50 transition-colors text-sm"
            >
              <ExternalLink className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="flex-1 truncate">{item.title || item.link_url}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
