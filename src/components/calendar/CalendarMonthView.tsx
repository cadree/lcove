import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarItem } from "@/hooks/useCalendar";
import { cn } from "@/lib/utils";

interface CalendarMonthViewProps {
  currentDate: Date;
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
  onDateClick: (date: Date) => void;
}

export function CalendarMonthView({ 
  currentDate, 
  items, 
  onItemClick,
  onDateClick 
}: CalendarMonthViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    const days: (Date | null)[] = [];
    
    // Add padding for days before the first day
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  }, [currentDate]);

  const getItemsForDate = (date: Date) => {
    return items.filter(item => {
      const itemDate = new Date(item.start_date);
      return itemDate.toDateString() === date.toDateString();
    });
  };

  const isToday = (date: Date) => {
    return date.toDateString() === new Date().toDateString();
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateClick(date);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="file-panel p-3">
      <div className="mb-2 grid grid-cols-7 gap-1">
        {weekDays.map(day => (
          <div
            key={day}
            className="mono-label py-2 text-center text-[8px] text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.008 }}
            className={cn(
              "min-h-[76px] rounded-[12px] border p-1 sm:min-h-[96px]",
              date ? "cursor-pointer border-border bg-card/40" : "border-transparent",
              date && selectedDate?.toDateString() === date.toDateString()
                ? "border-[hsl(var(--scan))] shadow-[inset_0_0_12px_rgba(121,195,207,0.28)]"
                : ""
            )}
            onClick={() => date && handleDateClick(date)}
          >
            {date && (
              <>
                <span className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full font-body text-[12px] font-extrabold",
                  isToday(date) ? "bg-[linear-gradient(180deg,#FFD6E8,#FF9FC8)] text-[#0A0A0A]" : "text-foreground"
                )}>
                  {date.getDate()}
                </span>
                <div className="mt-1 space-y-1 relative z-10">
                  {getItemsForDate(date).slice(0, 3).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onItemClick(item);
                      }}
                      className={cn(
                        "w-full text-left text-[10px] sm:text-xs px-1.5 py-1 rounded truncate cursor-pointer transition-all",
                        "hover:ring-2 hover:ring-primary/50 hover:scale-[1.02] active:scale-[0.98]",
                        item.type === 'event' ? "bg-primary/30 text-primary font-medium" : "",
                        item.type === 'project' ? "bg-[hsl(var(--scan)/0.45)] font-medium text-foreground" : "",
                        item.type === 'personal' ? "bg-secondary/50 text-secondary-foreground" : ""
                      )}
                    >
                      {item.title}
                    </button>
                  ))}
                  {getItemsForDate(date).length > 3 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{getItemsForDate(date).length - 3} more
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
