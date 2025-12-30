import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Copy,
  ExternalLink,
  Loader2,
  Save,
  Plus,
  Trash2,
  Clock,
  Link as LinkIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBookingPages, useCreateBookingPage, useUpdateBookingPage } from "@/hooks/useAppointments";
import type { BookingPage, AvailabilityConfig } from "@/hooks/useAppointments";
import { toast } from "sonner";

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday', 
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const DEFAULT_AVAILABILITY: AvailabilityConfig = {
  weekly: {
    mon: [{ start: '09:00', end: '17:00' }],
    tue: [{ start: '09:00', end: '17:00' }],
    wed: [{ start: '09:00', end: '17:00' }],
    thu: [{ start: '09:00', end: '17:00' }],
    fri: [{ start: '09:00', end: '17:00' }],
    sat: [],
    sun: [],
  },
  buffers: { before_min: 0, after_min: 0 },
  advance_days: 14,
};

const BookingSettings = () => {
  const { user } = useAuth();
  const { data: bookingPages, isLoading } = useBookingPages();
  const createBookingPage = useCreateBookingPage();
  const updateBookingPage = useUpdateBookingPage();

  const [editingPage, setEditingPage] = useState<BookingPage | null>(null);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("Book a Meeting");
  const [timezone, setTimezone] = useState("America/New_York");
  const [meetingLength, setMeetingLength] = useState(30);
  const [isActive, setIsActive] = useState(true);
  const [availability, setAvailability] = useState<AvailabilityConfig>(DEFAULT_AVAILABILITY);
  const [isCreating, setIsCreating] = useState(false);

  const resetForm = () => {
    setEditingPage(null);
    setSlug("");
    setTitle("Book a Meeting");
    setTimezone("America/New_York");
    setMeetingLength(30);
    setIsActive(true);
    setAvailability(DEFAULT_AVAILABILITY);
    setIsCreating(false);
  };

  const handleEdit = (page: BookingPage) => {
    setEditingPage(page);
    setSlug(page.slug);
    setTitle(page.title || "Book a Meeting");
    setTimezone(page.timezone);
    setMeetingLength(page.meeting_length_minutes);
    setIsActive(page.is_active);
    setAvailability(page.availability || DEFAULT_AVAILABILITY);
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!slug.trim()) {
      toast.error("Slug is required");
      return;
    }

    try {
      if (editingPage) {
        await updateBookingPage.mutateAsync({
          id: editingPage.id,
          slug,
          title,
          timezone,
          meeting_length_minutes: meetingLength,
          is_active: isActive,
          availability,
        });
      } else {
        await createBookingPage.mutateAsync({
          slug,
          title,
          timezone,
          meeting_length_minutes: meetingLength,
          is_active: isActive,
          availability,
        });
      }
      resetForm();
    } catch (error) {
      // Error handled in mutation
    }
  };

  const copyLink = (pageSlug: string) => {
    const url = `${window.location.origin}/book/${pageSlug}`;
    navigator.clipboard.writeText(url);
    toast.success("Booking link copied!");
  };

  const updateDayAvailability = (day: string, slots: { start: string; end: string }[]) => {
    setAvailability((prev) => ({
      ...prev,
      weekly: {
        ...prev.weekly,
        [day]: slots,
      },
    }));
  };

  const addTimeSlot = (day: string) => {
    const currentSlots = availability.weekly[day as keyof typeof availability.weekly] || [];
    updateDayAvailability(day, [...currentSlots, { start: '09:00', end: '17:00' }]);
  };

  const removeTimeSlot = (day: string, index: number) => {
    const currentSlots = availability.weekly[day as keyof typeof availability.weekly] || [];
    updateDayAvailability(day, currentSlots.filter((_, i) => i !== index));
  };

  const updateTimeSlot = (day: string, index: number, field: 'start' | 'end', value: string) => {
    const currentSlots = availability.weekly[day as keyof typeof availability.weekly] || [];
    const updated = currentSlots.map((slot, i) => 
      i === index ? { ...slot, [field]: value } : slot
    );
    updateDayAvailability(day, updated);
  };

  if (!user) {
    return (
      <PageLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
          <h2 className="font-display text-2xl text-foreground">Sign in to manage booking pages</h2>
          <Button asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="px-4 sm:px-6 py-6 pb-32 max-w-4xl mx-auto">
        <PageHeader
          title="Booking Pages"
          description="Let others book time with you"
          icon={<Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
          backPath="/settings"
          actions={
            !isCreating && (
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Booking Page
              </Button>
            )
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : isCreating ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="p-6 glass-strong border-border/30">
              <h3 className="text-lg font-semibold mb-4">
                {editingPage ? "Edit Booking Page" : "Create Booking Page"}
              </h3>

              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="slug">URL Slug</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">/book/</span>
                      <Input
                        id="slug"
                        placeholder="my-calendar"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        className="bg-background/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Page Title</Label>
                    <Input
                      id="title"
                      placeholder="Book a Meeting"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger className="bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Meeting Length</Label>
                    <Select value={String(meetingLength)} onValueChange={(v) => setMeetingLength(Number(v))}>
                      <SelectTrigger className="bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="45">45 minutes</SelectItem>
                        <SelectItem value="60">60 minutes</SelectItem>
                        <SelectItem value="90">90 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center gap-3 h-10">
                      <Switch checked={isActive} onCheckedChange={setIsActive} />
                      <span className="text-sm text-muted-foreground">
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator className="bg-border/50" />

                {/* Availability Editor */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Weekly Availability
                  </h4>

                  <div className="space-y-3">
                    {DAYS.map((day) => {
                      const slots = availability.weekly[day] || [];
                      return (
                        <div key={day} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                          <div className="w-24 font-medium text-sm pt-2">{DAY_LABELS[day]}</div>
                          <div className="flex-1 space-y-2">
                            {slots.length === 0 ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Unavailable</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => addTimeSlot(day)}
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              slots.map((slot, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <Input
                                    type="time"
                                    value={slot.start}
                                    onChange={(e) => updateTimeSlot(day, index, 'start', e.target.value)}
                                    className="w-32 bg-background/50"
                                  />
                                  <span className="text-muted-foreground">to</span>
                                  <Input
                                    type="time"
                                    value={slot.end}
                                    onChange={(e) => updateTimeSlot(day, index, 'end', e.target.value)}
                                    className="w-32 bg-background/50"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeTimeSlot(day, index)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                  {index === slots.length - 1 && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => addTimeSlot(day)}
                                    >
                                      <Plus className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator className="bg-border/50" />

                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSave}
                    disabled={createBookingPage.isPending || updateBookingPage.isPending}
                  >
                    {(createBookingPage.isPending || updateBookingPage.isPending) ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {editingPage ? "Update" : "Create"} Booking Page
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : bookingPages && bookingPages.length > 0 ? (
          <div className="space-y-4">
            {bookingPages.map((page) => (
              <motion.div
                key={page.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-4 glass-strong border-border/30">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{page.title || "Booking Page"}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          page.is_active 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {page.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <LinkIcon className="w-3 h-3" />
                        /book/{page.slug}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {page.meeting_length_minutes} min · {page.timezone.replace('_', ' ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLink(page.slug)}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copy Link
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <Link to={`/book/${page.slug}`} target="_blank">
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Preview
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(page)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="p-12 glass-strong border-border/30 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Booking Pages Yet</h3>
            <p className="text-muted-foreground mb-6">
              Create a booking page to let others schedule time with you.
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Booking Page
            </Button>
          </Card>
        )}
      </div>
    </PageLayout>
  );
};

export default BookingSettings;
