import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  User,
  Mail,
} from "lucide-react";
import { useBookingPageBySlug, useAppointmentsByOwner } from "@/hooks/useAppointments";
import type { AvailabilityConfig } from "@/hooks/useAppointments";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, startOfDay, parseISO, isSameDay, setHours, setMinutes } from "date-fns";

const PublicBookingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: bookingPage, isLoading: pageLoading, error: pageError } = useBookingPageBySlug(slug || "");
  
  // Fetch owner's existing appointments to check availability
  const ownerId = bookingPage?.owner_user_id;
  const { data: ownerAppointments } = useAppointmentsByOwner(ownerId || "");

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [dateOffset, setDateOffset] = useState(0);

  // Generate available dates (next 14 days by default)
  const availableDates = useMemo(() => {
    if (!bookingPage) return [];
    const availability = bookingPage.availability as AvailabilityConfig | undefined;
    const advanceDays = availability?.advance_days || 14;
    const dates: Date[] = [];
    const today = startOfDay(new Date());

    for (let i = 0; i < advanceDays; i++) {
      const date = addDays(today, i);
      dates.push(date);
    }

    return dates;
  }, [bookingPage]);

  // Get day key from date
  const getDayKey = (date: Date) => {
    const dayIndex = date.getDay();
    const dayMap: Record<number, string> = {
      0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
    };
    return dayMap[dayIndex];
  };

  // Generate time slots for selected date
  const timeSlots = useMemo(() => {
    if (!selectedDate || !bookingPage) return [];
    
    const availability = bookingPage.availability as AvailabilityConfig | undefined;
    if (!availability?.weekly) return [];

    const dayKey = getDayKey(selectedDate);
    const daySlots = availability.weekly[dayKey as keyof typeof availability.weekly] || [];
    const meetingLength = bookingPage.meeting_length_minutes;
    
    const slots: { start: Date; end: Date }[] = [];

    daySlots.forEach(({ start, end }) => {
      const [startHour, startMin] = start.split(':').map(Number);
      const [endHour, endMin] = end.split(':').map(Number);
      
      let currentTime = setMinutes(setHours(selectedDate, startHour), startMin);
      const endTime = setMinutes(setHours(selectedDate, endHour), endMin);

      while (currentTime < endTime) {
        const slotEnd = new Date(currentTime.getTime() + meetingLength * 60000);
        if (slotEnd <= endTime) {
          // Check for conflicts with existing appointments
          const hasConflict = ownerAppointments?.some(appt => {
            if (appt.status === 'canceled') return false;
            const apptStart = parseISO(appt.starts_at);
            const apptEnd = parseISO(appt.ends_at);
            return (currentTime < apptEnd && slotEnd > apptStart);
          });

          // Only add slot if it's in the future and no conflict
          if (!hasConflict && currentTime > new Date()) {
            slots.push({ start: new Date(currentTime), end: slotEnd });
          }
        }
        currentTime = new Date(currentTime.getTime() + meetingLength * 60000);
      }
    });

    return slots;
  }, [selectedDate, bookingPage, ownerAppointments]);

  const handleSubmit = async () => {
    if (!selectedSlot || !contactName.trim() || !contactEmail.trim() || !bookingPage) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!contactEmail.includes('@')) {
      toast.error("Please enter a valid email");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create booking request
      const { error: requestError } = await supabase
        .from('booking_requests')
        .insert({
          booking_page_id: bookingPage.id,
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim().toLowerCase(),
          requested_start: selectedSlot.start.toISOString(),
          requested_end: selectedSlot.end.toISOString(),
          status: 'confirmed',
        });

      if (requestError) throw requestError;

      // Create the actual appointment for the owner
      const { error: apptError } = await supabase
        .from('appointments')
        .insert({
          owner_user_id: bookingPage.owner_user_id,
          title: `Meeting with ${contactName.trim()}`,
          description: `Booked via booking page. Contact: ${contactEmail.trim()}`,
          starts_at: selectedSlot.start.toISOString(),
          ends_at: selectedSlot.end.toISOString(),
          status: 'confirmed',
        });

      if (apptError) throw apptError;

      setIsConfirmed(true);
      toast.success("Booking confirmed!");
    } catch (error: any) {
      console.error("Booking error:", error);
      toast.error(error.message || "Failed to create booking");
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibleDates = availableDates.slice(dateOffset, dateOffset + 7);

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (pageError || !bookingPage) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <Calendar className="w-16 h-16 text-muted-foreground" />
        <h1 className="text-2xl font-display font-bold text-foreground">Booking Page Not Found</h1>
        <p className="text-muted-foreground text-center max-w-md">
          This booking page doesn't exist or is currently inactive.
        </p>
        <Button asChild variant="outline">
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  if (isConfirmed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="p-8 text-center glass-strong border-border/30">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h1 className="text-2xl font-display font-bold mb-2">Booking Confirmed!</h1>
            <p className="text-muted-foreground mb-6">
              Your meeting has been scheduled for
            </p>
            {selectedSlot && (
              <div className="bg-background/50 rounded-lg p-4 mb-6">
                <p className="font-medium text-lg">
                  {format(selectedSlot.start, 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-muted-foreground">
                  {format(selectedSlot.start, 'h:mm a')} - {format(selectedSlot.end, 'h:mm a')}
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              A confirmation has been sent to {contactEmail}
            </p>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold mb-2">
              {bookingPage.title || "Book a Meeting"}
            </h1>
            <div className="flex items-center justify-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {bookingPage.meeting_length_minutes} min
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {bookingPage.timezone.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Date Selection */}
            <Card className="p-6 glass-strong border-border/30">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Select a Date
              </h2>

              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDateOffset(Math.max(0, dateOffset - 7))}
                  disabled={dateOffset === 0}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <span className="text-sm font-medium">
                  {visibleDates.length > 0 && (
                    <>
                      {format(visibleDates[0], 'MMM d')} - {format(visibleDates[visibleDates.length - 1], 'MMM d')}
                    </>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDateOffset(Math.min(availableDates.length - 7, dateOffset + 7))}
                  disabled={dateOffset + 7 >= availableDates.length}
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {visibleDates.map((date) => {
                  const availability = bookingPage.availability as AvailabilityConfig | undefined;
                  const dayKey = getDayKey(date);
                  const hasAvailability = (availability?.weekly?.[dayKey as keyof typeof availability.weekly] || []).length > 0;
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const isToday = isSameDay(date, new Date());

                  return (
                    <Button
                      key={date.toISOString()}
                      variant={isSelected ? "default" : "ghost"}
                      className={`flex flex-col h-auto py-2 ${
                        !hasAvailability ? 'opacity-50 cursor-not-allowed' : ''
                      } ${isToday && !isSelected ? 'ring-1 ring-primary' : ''}`}
                      onClick={() => hasAvailability && setSelectedDate(date)}
                      disabled={!hasAvailability}
                    >
                      <span className="text-xs text-muted-foreground">
                        {format(date, 'EEE')}
                      </span>
                      <span className="text-lg font-medium">
                        {format(date, 'd')}
                      </span>
                    </Button>
                  );
                })}
              </div>

              {selectedDate && (
                <div className="mt-6">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Available Times for {format(selectedDate, 'MMMM d')}
                  </h3>
                  {timeSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No available slots for this date.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                      {timeSlots.map((slot, index) => {
                        const isSelected = selectedSlot?.start.getTime() === slot.start.getTime();
                        return (
                          <Button
                            key={index}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedSlot(slot)}
                          >
                            {format(slot.start, 'h:mm a')}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Contact Form */}
            <Card className="p-6 glass-strong border-border/30">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Your Information
              </h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="Your name"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="pl-10 bg-background/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="pl-10 bg-background/50"
                    />
                  </div>
                </div>

                {selectedSlot && (
                  <div className="bg-primary/10 rounded-lg p-4">
                    <p className="text-sm font-medium mb-1">Selected Time</p>
                    <p className="text-foreground">
                      {format(selectedSlot.start, 'EEEE, MMMM d')}
                    </p>
                    <p className="text-muted-foreground">
                      {format(selectedSlot.start, 'h:mm a')} - {format(selectedSlot.end, 'h:mm a')}
                    </p>
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!selectedSlot || !contactName.trim() || !contactEmail.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    "Confirm Booking"
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PublicBookingPage;
