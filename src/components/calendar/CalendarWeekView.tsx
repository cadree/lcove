import { useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarItem } from "@/hooks/useCalendar";
import { cn } from "@/lib/utils";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";

interface CalendarWeekViewProps {
  currentDate: Date;
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
}

export function CalendarWeekView({ 
  currentDate, 
  items, 
  onItemClick 
}: CalendarWeekViewProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getItemsForDay = (date: Date) => {
    return items.filter(item => {
      const itemDate = new Date(item.start_date);
      return isSameDay(itemDate, date);
    });
  };

  const getItemPosition = (item: CalendarItem) => {
    const startDate = new Date(item.start_date);
    const hour = startDate.getHours();
    const minutes = startDate.getMinutes();
    return (hour * 60 + minutes) / (24 * 60) * 100;
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  return (
    <div className="glass-strong rounded-2xl overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-8 border-b border-border/30">
        <div className="p-2 text-xs text-muted-foreground" />
        {weekDays.map((day, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              "p-2 text-center border-l border-border/30",
              isToday(day) ? "bg-primary/10" : ""
            )}
          >
            <div className="text-xs text-muted-foreground">
              {format(day, 'EEE')}
            </div>
            <div className={cn(
              "text-lg font-medium",
              isToday(day) ? "text-primary" : "text-foreground"
            )}>
              {format(day, 'd')}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Time grid */}
      <div className="max-h-[600px] overflow-y-auto">
        <div className="grid grid-cols-8">
          {/* Time labels */}
          <div className="border-r border-border/30">
            {hours.map(hour => (
              <div key={hour} className="h-12 px-2 text-[10px] text-muted-foreground border-b border-border/10">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIndex) => (
            <div 
              key={dayIndex} 
              className={cn(
                "relative border-l border-border/30",
                isToday(day) ? "bg-primary/5" : ""
              )}
            >
              {hours.map(hour => (
                <div key={hour} className="h-12 border-b border-border/10" />
              ))}
              
              {/* Events */}
              {getItemsForDay(day).map((item, index) => (
                <motion.button
                  key={item.id}
                  type="button"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onItemClick(item);
                  }}
                  className={cn(
                    "absolute left-0 right-0 mx-1 px-1.5 py-1 rounded text-[10px] cursor-pointer overflow-hidden text-left z-10",
                    "hover:ring-2 hover:ring-white/50 hover:scale-[1.02] active:scale-[0.98] transition-all",
                    item.type === 'event' ? "bg-primary/90 text-primary-foreground" : "",
                    item.type === 'project' ? "bg-accent text-accent-foreground" : "",
                    item.type === 'personal' ? "bg-secondary text-secondary-foreground" : ""
                  )}
                  style={{
                    top: `${getItemPosition(item)}%`,
                    minHeight: '28px',
                  }}
                >
                  <div className="font-medium truncate">{item.title}</div>
                  <div className="text-[8px] opacity-80">
                    {format(new Date(item.start_date), 'h:mm a')}
                  </div>
                </motion.button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
