import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCreatePersonalItem } from "@/hooks/useCalendar";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface PersonalEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
}

export function PersonalEventDialog({ 
  open, 
  onOpenChange, 
  defaultDate 
}: PersonalEventDialogProps) {
  const { user } = useAuth();
  const createItem = useCreatePersonalItem();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState(
    defaultDate ? format(defaultDate, "yyyy-MM-dd'T'HH:mm") : ''
  );
  const [endDate, setEndDate] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(30);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please log in to add personal events');
      return;
    }

    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!startDate) {
      toast.error('Please select a date and time');
      return;
    }

    createItem.mutate({
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      start_date: new Date(startDate).toISOString(),
      end_date: endDate ? new Date(endDate).toISOString() : null,
      all_day: allDay,
      color: '#FF69B4',
      reminder_minutes: reminderMinutes,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      }
    });
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setStartDate('');
    setEndDate('');
    setAllDay(false);
    setReminderMinutes(30);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="glass-strong border-border/30">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Add Personal Event
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting, reminder, etc."
              className="glass"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Where is this happening?"
              className="glass"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="all-day">All Day Event</Label>
            <Switch
              id="all-day"
              checked={allDay}
              onCheckedChange={setAllDay}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start</Label>
              <Input
                id="start-date"
                type={allDay ? "date" : "datetime-local"}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="glass"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End (optional)</Label>
              <Input
                id="end-date"
                type={allDay ? "date" : "datetime-local"}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="glass"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Notes (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any notes..."
              className="glass min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder">Reminder</Label>
            <select
              id="reminder"
              value={reminderMinutes}
              onChange={(e) => setReminderMinutes(Number(e.target.value))}
              className="w-full glass rounded-md px-3 py-2 text-sm"
            >
              <option value={0}>No reminder</option>
              <option value={5}>5 minutes before</option>
              <option value={15}>15 minutes before</option>
              <option value={30}>30 minutes before</option>
              <option value={60}>1 hour before</option>
              <option value={1440}>1 day before</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="glass"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createItem.isPending}
              className="flex-1"
            >
              {createItem.isPending ? 'Adding...' : 'Add Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
