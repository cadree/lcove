import { useState } from "react";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MapPin, Ticket, Coins } from "lucide-react";

const events = [
  {
    id: 1,
    title: "Creative Collective Meetup",
    date: new Date(2025, 0, 5),
    time: "7:00 PM",
    venue: "The Warehouse Gallery",
    city: "Los Angeles",
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop",
    ticketType: "Free",
    attendees: 45,
  },
  {
    id: 2,
    title: "Portfolio Review Night",
    date: new Date(2025, 0, 12),
    time: "6:30 PM",
    venue: "Studio 54",
    city: "New York",
    image: "https://images.unsplash.com/photo-1528605105345-5344ea20e269?w=400&h=300&fit=crop",
    ticketType: "Credits",
    attendees: 28,
  },
  {
    id: 3,
    title: "Sound Design Workshop",
    date: new Date(2025, 0, 18),
    time: "2:00 PM",
    venue: "Echo Studios",
    city: "Austin",
    image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&h=300&fit=crop",
    ticketType: "Paid",
    attendees: 15,
  },
  {
    id: 4,
    title: "Film Screening & Q&A",
    date: new Date(2025, 0, 25),
    time: "8:00 PM",
    venue: "Indie Cinema",
    city: "Chicago",
    image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&h=300&fit=crop",
    ticketType: "Paid",
    attendees: 120,
  },
];

const CalendarPage = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 0, 1));
  const [selectedCity, setSelectedCity] = useState("All Cities");

  const cities = ["All Cities", "Los Angeles", "New York", "Austin", "Chicago"];

  const filteredEvents = selectedCity === "All Cities"
    ? events
    : events.filter(e => e.city === selectedCity);

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const getTicketIcon = (type: string) => {
    if (type === "Credits") return <Coins className="w-3 h-3" />;
    return <Ticket className="w-3 h-3" />;
  };

  return (
    <PageLayout>
      <div className="px-6 pt-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-3xl font-medium text-foreground mb-2">Calendar</h1>
          <p className="text-muted-foreground">Community events, workshops, and gatherings</p>
        </motion.div>

        {/* Month Navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-between mb-6"
        >
          <Button
            variant="glass"
            size="icon"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-display text-xl font-medium text-foreground">{monthName}</h2>
          <Button
            variant="glass"
            size="icon"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </motion.div>

        {/* City Filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide"
        >
          {cities.map((city) => (
            <Button
              key={city}
              variant={selectedCity === city ? "default" : "glass"}
              size="sm"
              onClick={() => setSelectedCity(city)}
              className="whitespace-nowrap"
            >
              <MapPin className="w-3 h-3 mr-1" />
              {city}
            </Button>
          ))}
        </motion.div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredEvents.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="glass-strong rounded-2xl overflow-hidden hover:bg-accent/20 transition-all duration-300 cursor-pointer group"
            >
              {/* Event Image */}
              <div
                className="h-40 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url(${event.image})` }}
              />

              {/* Event Info */}
              <div className="p-5">
                {/* Date Badge */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-primary/15 text-primary">
                    <span className="text-xs font-medium">
                      {event.date.toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-lg font-bold leading-none">
                      {event.date.getDate()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-medium text-foreground line-clamp-1">
                      {event.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{event.time}</p>
                  </div>
                </div>

                {/* Venue & City */}
                <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {event.venue}, {event.city}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent/50 text-xs text-accent-foreground">
                    {getTicketIcon(event.ticketType)}
                    {event.ticketType}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {event.attendees} attending
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredEvents.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-muted-foreground text-lg mb-2">No events this month</p>
            <p className="text-muted-foreground/70 text-sm">
              Check back soon or try a different city
            </p>
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
};

export default CalendarPage;
