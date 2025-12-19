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
    <div className="glass-strong rounded-2xl p-4">
      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div 
            key={day} 
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.01 }}
            className={cn(
              "min-h-[80px] sm:min-h-[100px] rounded-xl p-1 cursor-pointer transition-all duration-200",
              date ? "hover:bg-accent/30" : "",
              date && isToday(date) ? "bg-primary/10 ring-1 ring-primary/30" : "",
              date && selectedDate?.toDateString() === date.toDateString() 
                ? "bg-accent/50 ring-1 ring-accent" 
                : ""
            )}
            onClick={() => date && handleDateClick(date)}
          >
            {date && (
              <>
                <span className={cn(
                  "text-xs font-medium",
                  isToday(date) ? "text-primary" : "text-foreground"
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
                        item.type === 'project' ? "bg-accent/50 text-accent-foreground" : "",
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
