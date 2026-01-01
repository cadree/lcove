import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  List,
  Grid3X3,
  Plus,
  Globe,
  User
} from "lucide-react";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import { CalendarAgendaView } from "@/components/calendar/CalendarAgendaView";
import { CalendarFilters } from "@/components/calendar/CalendarFilters";
import { EventDetailDialog } from "@/components/calendar/EventDetailDialog";
import { PersonalEventDialog } from "@/components/calendar/PersonalEventDialog";
import { PersonalEventDetailDialog } from "@/components/calendar/PersonalEventDetailDialog";
import { CreateCommunityEventDialog } from "@/components/calendar/CreateCommunityEventDialog";
import { useCalendarItems, CalendarItem, PersonalCalendarItem } from "@/hooks/useCalendar";
import { useAuth } from "@/contexts/AuthContext";
import { addMonths, subMonths, addWeeks, subWeeks, format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ViewType = 'month' | 'week' | 'agenda';

const US_STATES = [
  'All States', 'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 
  'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 
  'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
  'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming'
];

const CITIES = [
  'All Cities', 'Los Angeles', 'New York', 'Chicago', 'Houston', 'Phoenix',
  'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin', 'San Jose',
  'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte', 'Indianapolis',
  'San Francisco', 'Seattle', 'Denver', 'Nashville', 'Portland', 'Las Vegas',
  'Detroit', 'Memphis', 'Boston', 'Baltimore', 'Miami', 'Atlanta'
];

const CalendarPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [selectedCity, setSelectedCity] = useState('All Cities');
  const [selectedState, setSelectedState] = useState('All States');
  const [selectedTypes, setSelectedTypes] = useState(['events', 'projects', 'personal']);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [personalEventOpen, setPersonalEventOpen] = useState(false);
  const [communityEventOpen, setCommunityEventOpen] = useState(false);
  const [selectedDateForNew, setSelectedDateForNew] = useState<Date | undefined>();
  const [selectedPersonalItem, setSelectedPersonalItem] = useState<PersonalCalendarItem | null>(null);
  const [personalDetailOpen, setPersonalDetailOpen] = useState(false);

  // Handle URL params for deep linking to events and ticket confirmations
  useEffect(() => {
    const eventId = searchParams.get('event');
    const ticketSuccess = searchParams.get('ticket_success');
    const ticketCancelled = searchParams.get('ticket_cancelled');

    if (eventId) {
      setSelectedEventId(eventId);
      setEventDialogOpen(true);
    }

    if (ticketSuccess === 'true') {
      toast.success('Ticket purchased successfully! Check your email for confirmation.');
    }

    if (ticketCancelled === 'true') {
      toast.error('Ticket purchase was cancelled.');
    }
  }, [searchParams]);

  const calendarItems = useCalendarItems({
    city: selectedCity,
    state: selectedState,
    types: selectedTypes,
  });

  const navigatePrevious = () => {
    if (view === 'month' || view === 'agenda') {
      setCurrentDate(prev => subMonths(prev, 1));
    } else {
      setCurrentDate(prev => subWeeks(prev, 1));
    }
  };

  const navigateNext = () => {
    if (view === 'month' || view === 'agenda') {
      setCurrentDate(prev => addMonths(prev, 1));
    } else {
      setCurrentDate(prev => addWeeks(prev, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleItemClick = (item: CalendarItem) => {
    if (item.type === 'event') {
      setSelectedEventId(item.id);
      setEventDialogOpen(true);
    } else if (item.type === 'project') {
      navigate(`/projects?id=${item.id}`);
    } else if (item.type === 'personal') {
      // Open personal event detail dialog
      setSelectedPersonalItem(item.data as PersonalCalendarItem);
      setPersonalDetailOpen(true);
    }
  };

  const handleDateClick = (date: Date) => {
    if (!user) {
      toast.error('Please log in to add events');
      return;
    }
    setSelectedDateForNew(date);
    // Default to personal event on date click
    setPersonalEventOpen(true);
  };

  const getNavigationLabel = () => {
    if (view === 'month' || view === 'agenda') {
      return format(currentDate, 'MMMM yyyy');
    }
    return `Week of ${format(currentDate, 'MMM d, yyyy')}`;
  };

  return (
    <PageLayout>
      <div className="px-4 sm:px-6 pt-6 pb-24">
        {/* Header */}
        <PageHeader
          title="Calendar"
          description="Community events, projects, and personal schedule"
          icon={<CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
          backPath="/"
          actions={
            user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Event
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-strong border-border/30">
                  <DropdownMenuItem onClick={() => {
                    setSelectedDateForNew(undefined);
                    setCommunityEventOpen(true);
                  }}>
                    <Globe className="w-4 h-4 mr-2 text-primary" />
                    Community Event
                    <span className="ml-2 text-xs text-muted-foreground">Public</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setSelectedDateForNew(undefined);
                    setPersonalEventOpen(true);
                  }}>
                    <User className="w-4 h-4 mr-2" />
                    Personal Reminder
                    <span className="ml-2 text-xs text-muted-foreground">Private</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }
        />

        {/* View Switcher & Navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6"
        >
          {/* View Tabs */}
          <div className="flex gap-1 glass-strong rounded-xl p-1">
            <Button
              variant={view === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('month')}
              className="gap-2"
            >
              <Grid3X3 className="w-4 h-4" />
              <span className="hidden sm:inline">Month</span>
            </Button>
            <Button
              variant={view === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('week')}
              className="gap-2"
            >
              <CalendarIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Week</span>
            </Button>
            <Button
              variant={view === 'agenda' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('agenda')}
              className="gap-2"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Agenda</span>
            </Button>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-2 flex-1 justify-center sm:justify-start">
            <Button variant="glass" size="icon" onClick={navigatePrevious}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button variant="glass" size="sm" onClick={goToToday}>
              Today
            </Button>
            <h2 className="font-display text-lg font-medium text-foreground min-w-[160px] text-center">
              {getNavigationLabel()}
            </h2>
            <Button variant="glass" size="icon" onClick={navigateNext}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <CalendarFilters
            selectedCity={selectedCity}
            selectedState={selectedState}
            selectedTypes={selectedTypes}
            cities={CITIES}
            states={US_STATES}
            onCityChange={setSelectedCity}
            onStateChange={setSelectedState}
            onTypesChange={setSelectedTypes}
          />
        </motion.div>

        {/* Calendar View */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {view === 'month' && (
            <CalendarMonthView
              currentDate={currentDate}
              items={calendarItems}
              onItemClick={handleItemClick}
              onDateClick={handleDateClick}
            />
          )}
          {view === 'week' && (
            <CalendarWeekView
              currentDate={currentDate}
              items={calendarItems}
              onItemClick={handleItemClick}
            />
          )}
          {view === 'agenda' && (
            <CalendarAgendaView
              currentDate={currentDate}
              items={calendarItems}
              onItemClick={handleItemClick}
            />
          )}
        </motion.div>

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-primary" />
            <span>Events</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-accent" />
            <span>Projects</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-secondary" />
            <span>Personal</span>
          </div>
        </motion.div>
      </div>

      {/* Event Detail Dialog */}
      <EventDetailDialog
        eventId={selectedEventId}
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
      />

      {/* Personal Event Dialog */}
      <PersonalEventDialog
        open={personalEventOpen}
        onOpenChange={setPersonalEventOpen}
        defaultDate={selectedDateForNew}
      />

      {/* Community Event Dialog */}
      <CreateCommunityEventDialog
        open={communityEventOpen}
        onOpenChange={setCommunityEventOpen}
        defaultDate={selectedDateForNew}
      />

      {/* Personal Event Detail Dialog */}
      <PersonalEventDetailDialog
        item={selectedPersonalItem}
        open={personalDetailOpen}
        onOpenChange={setPersonalDetailOpen}
      />
    </PageLayout>
  );
};

export default CalendarPage;
