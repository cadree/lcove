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
    <section className="file-panel overflow-hidden p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="kicker">// Month grid</p>
        <p className="mono-label text-[8px] text-muted-foreground">Filed</p>
      </div>
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map(day => (
          <div
            key={day}
            className="mono-label py-2 text-center text-[9px] text-[hsl(var(--scan))]"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border">
        {calendarDays.map((date, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.008 }}
            className={cn(
              "min-h-[78px] bg-card p-1 sm:min-h-[96px]",
              date ? "cursor-pointer" : "bg-background/50",
              date && selectedDate?.toDateString() === date.toDateString()
                ? "bg-[color-mix(in_srgb,hsl(var(--scan))_18%,hsl(var(--card)))] shadow-[inset_0_0_0_1px_hsl(var(--scan))]"
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
                <div className="relative z-10 mt-1 space-y-1">
                  {getItemsForDate(date).slice(0, 2).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onItemClick(item);
                      }}
                      className={cn(
                        "block w-full cursor-pointer truncate rounded-full px-1.5 py-0.5 text-left font-mono text-[8px] uppercase tracking-wide",
                        item.type === 'event' ? "bg-[linear-gradient(180deg,#FFD6E8,#FF9FC8)] text-[#0A0A0A]" : "",
                        item.type === 'project' ? "bg-[hsl(var(--scan))] text-[#0A0A0A]" : "",
                        item.type === 'personal' ? "border border-border bg-[hsl(var(--panel-2))] text-foreground" : ""
                      )}
                    >
                      {item.title}
                    </button>
                  ))}
                  {getItemsForDate(date).length > 2 && (
                    <div className="mono-label text-[7px] text-muted-foreground">
                      +{getItemsForDate(date).length - 2}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
