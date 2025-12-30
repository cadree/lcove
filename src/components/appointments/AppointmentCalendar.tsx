import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, setHours, setMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Users, User } from "lucide-react";
import { Appointment, useAppointments, useTeams } from "@/hooks/useAppointments";
import { AppointmentModal } from "./AppointmentModal";
import { AppointmentDetailPopover } from "./AppointmentDetailPopover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am to 9pm

export function AppointmentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState<'personal' | 'team'>('personal');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [detailPopoverOpen, setDetailPopoverOpen] = useState(false);

  const { data: teams, isLoading: teamsLoading } = useTeams();
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = addDays(weekStart, 7);

  const { data: appointments, isLoading } = useAppointments({
    teamId: calendarMode === 'team' ? selectedTeamId : null,
    startDate: weekStart,
    endDate: weekEnd,
  });

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const handlePrevWeek = () => setCurrentDate(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentDate(prev => addWeeks(prev, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleCellClick = (date: Date, hour: number) => {
    setSelectedSlot({ date, hour });
    setCreateModalOpen(true);
  };

  const handleAppointmentClick = (appointment: Appointment, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAppointment(appointment);
    setDetailPopoverOpen(true);
  };

  const getAppointmentsForDayHour = (date: Date, hour: number) => {
    if (!appointments) return [];
    return appointments.filter(apt => {
      const aptStart = new Date(apt.starts_at);
      const aptHour = aptStart.getHours();
      return isSameDay(aptStart, date) && aptHour === hour;
    });
  };

  const getAppointmentStyle = (apt: Appointment) => {
    const start = new Date(apt.starts_at);
    const end = new Date(apt.ends_at);
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    const heightPercent = (durationMinutes / 60) * 100;
    const topOffset = (start.getMinutes() / 60) * 100;

    return {
      height: `${Math.max(heightPercent, 25)}%`,
      top: `${topOffset}%`,
    };
  };

  const isToday = (date: Date) => isSameDay(date, new Date());
  const hasTeams = teams && teams.length > 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handlePrevWeek}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleToday}>
            Today
          </Button>
          <h2 className="font-display text-lg font-medium min-w-[180px] text-center">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </h2>
          <Button variant="ghost" size="icon" onClick={handleNextWeek}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {/* Calendar Mode Toggle */}
          {hasTeams && (
            <div className="flex gap-1 glass-strong rounded-xl p-1">
              <Button
                variant={calendarMode === 'personal' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCalendarMode('personal')}
                className="gap-2"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Personal</span>
              </Button>
              <Button
                variant={calendarMode === 'team' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCalendarMode('team')}
                className="gap-2"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Team</span>
              </Button>
            </div>
          )}

          {/* Team Selector */}
          {calendarMode === 'team' && hasTeams && (
            <Select value={selectedTeamId || ''} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button onClick={() => {
            setSelectedSlot(null);
            setCreateModalOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Week Grid */}
      <div className="glass-strong rounded-2xl overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-8 border-b border-border/30">
          <div className="p-2 text-xs text-muted-foreground" />
          {weekDays.map((day, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={cn(
                "p-3 text-center border-l border-border/30",
                isToday(day) && "bg-primary/10"
              )}
            >
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                {format(day, 'EEE')}
              </div>
              <div className={cn(
                "text-xl font-medium mt-1",
                isToday(day) ? "text-primary" : "text-foreground"
              )}>
                {format(day, 'd')}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Time Grid */}
        <div className="max-h-[600px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8">
              <Skeleton className="h-[400px] w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-8">
              {/* Time Labels */}
              <div className="border-r border-border/30">
                {HOURS.map(hour => (
                  <div 
                    key={hour} 
                    className="h-16 px-2 flex items-start justify-end pt-1 text-xs text-muted-foreground border-b border-border/10"
                  >
                    {format(setHours(new Date(), hour), 'h a')}
                  </div>
                ))}
              </div>

              {/* Day Columns */}
              {weekDays.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={cn(
                    "border-l border-border/30",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  {HOURS.map(hour => {
                    const cellAppointments = getAppointmentsForDayHour(day, hour);
                    
                    return (
                      <div
                        key={hour}
                        className="h-16 border-b border-border/10 relative cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => handleCellClick(day, hour)}
                      >
                        {cellAppointments.map((apt, aptIndex) => (
                          <motion.button
                            key={apt.id}
                            type="button"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={(e) => handleAppointmentClick(apt, e)}
                            className={cn(
                              "absolute left-1 right-1 px-2 py-1 rounded text-xs cursor-pointer overflow-hidden text-left z-10",
                              "hover:ring-2 hover:ring-primary/50 transition-all",
                              apt.status === 'confirmed' && "bg-primary/90 text-primary-foreground",
                              apt.status === 'canceled' && "bg-muted text-muted-foreground line-through",
                              apt.status === 'completed' && "bg-accent text-accent-foreground"
                            )}
                            style={{
                              ...getAppointmentStyle(apt),
                              marginLeft: aptIndex * 4,
                            }}
                          >
                            <div className="font-medium truncate">{apt.title}</div>
                            <div className="text-[10px] opacity-80">
                              {format(new Date(apt.starts_at), 'h:mm a')}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {!isLoading && (!appointments || appointments.length === 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <Plus className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No appointments this week</h3>
          <p className="text-muted-foreground mb-4">Create your first appointment to get started</p>
          <Button onClick={() => {
            setSelectedSlot(null);
            setCreateModalOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Create Appointment
          </Button>
        </motion.div>
      )}

      {/* Create Modal */}
      <AppointmentModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        defaultDate={selectedSlot?.date}
        defaultHour={selectedSlot?.hour}
        defaultTeamId={calendarMode === 'team' ? selectedTeamId : null}
      />

      {/* Detail Popover */}
      <AppointmentDetailPopover
        appointment={selectedAppointment}
        open={detailPopoverOpen}
        onOpenChange={setDetailPopoverOpen}
      />
    </div>
  );
}
