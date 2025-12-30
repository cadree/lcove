import { useState, useEffect } from "react";
import { format, setHours, setMinutes, addMinutes, differenceInMinutes } from "date-fns";
import { CalendarIcon, Clock, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Appointment, useUpdateAppointment, useContacts } from "@/hooks/useAppointments";

interface EditAppointmentModalProps {
  appointment: Appointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

export function EditAppointmentModal({
  appointment,
  open,
  onOpenChange,
}: EditAppointmentModalProps) {
  const startDate = new Date(appointment.starts_at);
  const endDate = new Date(appointment.ends_at);
  const initialDuration = differenceInMinutes(endDate, startDate);

  const [title, setTitle] = useState(appointment.title);
  const [description, setDescription] = useState(appointment.description || '');
  const [location, setLocation] = useState(appointment.location || '');
  const [date, setDate] = useState<Date | undefined>(startDate);
  const [startHour, setStartHour] = useState(startDate.getHours());
  const [startMinute, setStartMinute] = useState(startDate.getMinutes());
  const [duration, setDuration] = useState(initialDuration);
  const [contactId, setContactId] = useState<string | null>(appointment.contact_id);

  const { data: contacts } = useContacts();
  const updateAppointment = useUpdateAppointment();

  useEffect(() => {
    if (open) {
      const start = new Date(appointment.starts_at);
      const end = new Date(appointment.ends_at);
      setTitle(appointment.title);
      setDescription(appointment.description || '');
      setLocation(appointment.location || '');
      setDate(start);
      setStartHour(start.getHours());
      setStartMinute(start.getMinutes());
      setDuration(differenceInMinutes(end, start));
      setContactId(appointment.contact_id);
    }
  }, [open, appointment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !title.trim()) return;

    const startsAt = setMinutes(setHours(date, startHour), startMinute);
    const endsAt = addMinutes(startsAt, duration);

    await updateAppointment.mutateAsync({
      id: appointment.id,
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      contact_id: contactId,
    });

    onOpenChange(false);
  };

  // Find closest duration option
  const closestDuration = DURATIONS.reduce((prev, curr) => 
    Math.abs(curr.value - duration) < Math.abs(prev.value - duration) ? curr : prev
  ).value;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Appointment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting with client"
              required
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Start Time</Label>
              <div className="flex gap-2">
                <Select value={String(startHour)} onValueChange={(v) => setStartHour(Number(v))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map(h => (
                      <SelectItem key={h} value={String(h)}>
                        {format(setHours(new Date(), h), 'h a')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(startMinute)} onValueChange={(v) => setStartMinute(Number(v))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MINUTES.map(m => (
                      <SelectItem key={m} value={String(m)}>
                        :{m.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={String(closestDuration)} onValueChange={(v) => setDuration(Number(v))}>
              <SelectTrigger>
                <Clock className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map(d => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contact */}
          {contacts && contacts.length > 0 && (
            <div className="space-y-2">
              <Label>Contact (optional)</Label>
              <Select value={contactId || 'none'} onValueChange={(v) => setContactId(v === 'none' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No contact</SelectItem>
                  {contacts.map(contact => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="edit-location">Location (optional)</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="edit-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Office, Zoom link, etc."
                className="pl-10"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Notes (optional)</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any additional details..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateAppointment.isPending || !title.trim()}>
              {updateAppointment.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
