import { useState, useEffect } from "react";
import { format, setHours, setMinutes, addMinutes } from "date-fns";
import { CalendarIcon, Clock, MapPin, Users, User } from "lucide-react";
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
import { useCreateAppointment, useTeams, useContacts } from "@/hooks/useAppointments";

interface AppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultHour?: number;
  defaultTeamId?: string | null;
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

export function AppointmentModal({
  open,
  onOpenChange,
  defaultDate,
  defaultHour,
  defaultTeamId,
}: AppointmentModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState<Date | undefined>(defaultDate || new Date());
  const [startHour, setStartHour] = useState(defaultHour || 9);
  const [startMinute, setStartMinute] = useState(0);
  const [duration, setDuration] = useState(30);
  const [scope, setScope] = useState<'personal' | 'team'>('personal');
  const [teamId, setTeamId] = useState<string | null>(defaultTeamId || null);
  const [contactId, setContactId] = useState<string | null>(null);

  const { data: teams } = useTeams();
  const { data: contacts } = useContacts();
  const createAppointment = useCreateAppointment();

  const hasTeams = teams && teams.length > 0;

  useEffect(() => {
    if (open) {
      setDate(defaultDate || new Date());
      setStartHour(defaultHour || 9);
      if (defaultTeamId) {
        setScope('team');
        setTeamId(defaultTeamId);
      }
    }
  }, [open, defaultDate, defaultHour, defaultTeamId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !title.trim()) return;

    const startsAt = setMinutes(setHours(date, startHour), startMinute);
    const endsAt = addMinutes(startsAt, duration);

    await createAppointment.mutateAsync({
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      team_id: scope === 'team' ? teamId : null,
      contact_id: contactId,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setLocation('');
    setContactId(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Appointment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Scope Toggle */}
          {hasTeams && (
            <div className="space-y-2">
              <Label>Scope</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={scope === 'personal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScope('personal')}
                  className="flex-1"
                >
                  <User className="w-4 h-4 mr-2" />
                  Personal
                </Button>
                <Button
                  type="button"
                  variant={scope === 'team' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScope('team')}
                  className="flex-1"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Team
                </Button>
              </div>
            </div>
          )}

          {/* Team Selector */}
          {scope === 'team' && hasTeams && (
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={teamId || ''} onValueChange={setTeamId}>
                <SelectTrigger>
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
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
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
            <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
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
            <Label htmlFor="location">Location (optional)</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Office, Zoom link, etc."
                className="pl-10"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Notes (optional)</Label>
            <Textarea
              id="description"
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
            <Button type="submit" disabled={createAppointment.isPending || !title.trim()}>
              {createAppointment.isPending ? 'Creating...' : 'Create Appointment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
