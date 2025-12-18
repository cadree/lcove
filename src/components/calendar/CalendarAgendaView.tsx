import { useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarItem } from "@/hooks/useCalendar";
import { cn } from "@/lib/utils";
import { format, isSameDay, isToday as checkIsToday } from "date-fns";
import { MapPin, Calendar, Clock, Ticket, Coins, User } from "lucide-react";

interface CalendarAgendaViewProps {
  currentDate: Date;
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
}

export function CalendarAgendaView({ 
  currentDate, 
  items, 
  onItemClick 
}: CalendarAgendaViewProps) {
  const groupedItems = useMemo(() => {
    const groups: { date: Date; items: CalendarItem[] }[] = [];
    
    // Filter items for the current month
    const monthItems = items.filter(item => {
      const itemDate = new Date(item.start_date);
      return itemDate.getMonth() === currentDate.getMonth() &&
             itemDate.getFullYear() === currentDate.getFullYear();
    });

    // Group by date
    monthItems.forEach(item => {
      const itemDate = new Date(item.start_date);
      const existingGroup = groups.find(g => isSameDay(g.date, itemDate));
      
      if (existingGroup) {
        existingGroup.items.push(item);
      } else {
        groups.push({ date: itemDate, items: [item] });
      }
    });

    // Sort by date
    groups.sort((a, b) => a.date.getTime() - b.date.getTime());

    return groups;
  }, [items, currentDate]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'event': return <Calendar className="w-4 h-4" />;
      case 'project': return <User className="w-4 h-4" />;
      case 'personal': return <Clock className="w-4 h-4" />;
      default: return null;
    }
  };

  const getTicketIcon = (ticketType: string) => {
    if (ticketType === 'credits') return <Coins className="w-3 h-3" />;
    return <Ticket className="w-3 h-3" />;
  };

  if (groupedItems.length === 0) {
    return (
      <div className="glass-strong rounded-2xl p-8 text-center">
        <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No events this month</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Try a different month or add a personal event
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedItems.map((group, groupIndex) => (
        <motion.div
          key={group.date.toISOString()}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: groupIndex * 0.1 }}
          className="glass-strong rounded-2xl overflow-hidden"
        >
          {/* Date header */}
          <div className={cn(
            "px-4 py-3 border-b border-border/30",
            checkIsToday(group.date) ? "bg-primary/10" : "bg-accent/20"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex flex-col items-center justify-center w-12 h-12 rounded-xl",
                checkIsToday(group.date) ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              )}>
                <span className="text-xs font-medium">
                  {format(group.date, 'MMM')}
                </span>
                <span className="text-lg font-bold leading-none">
                  {format(group.date, 'd')}
                </span>
              </div>
              <div>
                <p className={cn(
                  "font-medium",
                  checkIsToday(group.date) ? "text-primary" : "text-foreground"
                )}>
                  {checkIsToday(group.date) ? 'Today' : format(group.date, 'EEEE')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                </p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="divide-y divide-border/20">
            {group.items.map((item, itemIndex) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: groupIndex * 0.1 + itemIndex * 0.05 }}
                onClick={() => onItemClick(item)}
                className="p-4 hover:bg-accent/20 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Type indicator */}
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    item.type === 'event' ? "bg-primary/20 text-primary" : "",
                    item.type === 'project' ? "bg-accent/50 text-accent-foreground" : "",
                    item.type === 'personal' ? "bg-secondary/50 text-secondary-foreground" : ""
                  )}>
                    {getTypeIcon(item.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground truncate">
                      {item.title}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(item.start_date), 'h:mm a')}
                      </span>

                      {item.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {item.city}{item.state ? `, ${item.state}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Event-specific info */}
                    {item.type === 'event' && 'ticket_type' in item.data && item.data.ticket_type && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs",
                          item.data.ticket_type === 'free' ? "bg-green-500/20 text-green-400" : "",
                          item.data.ticket_type === 'paid' ? "bg-primary/20 text-primary" : "",
                          item.data.ticket_type === 'credits' ? "bg-accent/50 text-accent-foreground" : ""
                        )}>
                          {getTicketIcon(item.data.ticket_type)}
                          {item.data.ticket_type === 'free' ? 'Free' : 
                           item.data.ticket_type === 'paid' ? `$${(item.data as any).ticket_price}` :
                           `${(item.data as any).credits_price} Credits`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Type badge */}
                  <span className={cn(
                    "px-2 py-1 rounded-md text-xs capitalize shrink-0",
                    item.type === 'event' ? "bg-primary/20 text-primary" : "",
                    item.type === 'project' ? "bg-accent/50 text-accent-foreground" : "",
                    item.type === 'personal' ? "bg-secondary/50 text-secondary-foreground" : ""
                  )}>
                    {item.type}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
