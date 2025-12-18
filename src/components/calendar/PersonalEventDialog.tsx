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
import { Upload, X, Calendar, DollarSign, Link as LinkIcon, Ticket, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PersonalEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
}

type TicketType = 'free' | 'paid' | 'external';

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
  const [startDateValue, setStartDateValue] = useState(
    defaultDate ? format(defaultDate, "yyyy-MM-dd") : ''
  );
  const [startTimeValue, setStartTimeValue] = useState(
    defaultDate ? format(defaultDate, "HH:mm") : ''
  );
  const [endDateValue, setEndDateValue] = useState('');
  const [endTimeValue, setEndTimeValue] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(30);
  
  // Image upload
  const [imageUrl, setImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Ticketing
  const [ticketType, setTicketType] = useState<TicketType>('free');
  const [ticketPrice, setTicketPrice] = useState('');
  const [creditsPrice, setCreditsPrice] = useState('');
  const [externalLink, setExternalLink] = useState('');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `event-${Date.now()}.${fileExt}`;
      const filePath = `event-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
      toast.success('Image uploaded!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeImage = () => {
    setImageUrl('');
  };

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

    if (!startDateValue) {
      toast.error('Please select a date');
      return;
    }

    // Combine date and time
    const startDateTime = allDay 
      ? `${startDateValue}T00:00:00`
      : `${startDateValue}T${startTimeValue || '00:00'}:00`;
    
    const endDateTime = endDateValue
      ? (allDay ? `${endDateValue}T23:59:59` : `${endDateValue}T${endTimeValue || '23:59'}:00`)
      : null;

    createItem.mutate({
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      start_date: new Date(startDateTime).toISOString(),
      end_date: endDateTime ? new Date(endDateTime).toISOString() : null,
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

  const addToGoogleCalendar = () => {
    if (!title || !startDateValue) {
      toast.error('Please fill in the event title and date first');
      return;
    }

    const startDateTime = allDay 
      ? startDateValue.replace(/-/g, '')
      : `${startDateValue.replace(/-/g, '')}T${(startTimeValue || '00:00').replace(':', '')}00`;
    
    const endDateTime = endDateValue
      ? (allDay 
        ? endDateValue.replace(/-/g, '')
        : `${endDateValue.replace(/-/g, '')}T${(endTimeValue || '23:59').replace(':', '')}00`)
      : startDateTime;

    const googleCalendarUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalendarUrl.searchParams.set('action', 'TEMPLATE');
    googleCalendarUrl.searchParams.set('text', title);
    googleCalendarUrl.searchParams.set('dates', `${startDateTime}/${endDateTime}`);
    
    if (description) {
      googleCalendarUrl.searchParams.set('details', description);
    }
    if (location) {
      googleCalendarUrl.searchParams.set('location', location);
    }

    window.open(googleCalendarUrl.toString(), '_blank');
    toast.success('Opening Google Calendar...');
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setStartDateValue('');
    setStartTimeValue('');
    setEndDateValue('');
    setEndTimeValue('');
    setAllDay(false);
    setReminderMinutes(30);
    setImageUrl('');
    setTicketType('free');
    setTicketPrice('');
    setCreditsPrice('');
    setExternalLink('');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="glass-strong border-border/30 max-h-[80vh] overflow-y-auto pb-24 sm:pb-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Add Personal Event
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting, reminder, etc."
              className="glass"
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Event Image (optional)</Label>
            {imageUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img 
                  src={imageUrl} 
                  alt="Event" 
                  className="w-full h-32 object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={removeImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-sm text-muted-foreground">
                  {isUploadingImage ? 'Uploading...' : 'Upload image'}
                </span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploadingImage}
                />
              </label>
            )}
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

          {/* Separate Date & Time */}
          <div className="space-y-3">
            <Label>Start</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={startDateValue}
                onChange={(e) => setStartDateValue(e.target.value)}
                className="glass"
              />
              {!allDay && (
                <Input
                  type="time"
                  value={startTimeValue}
                  onChange={(e) => setStartTimeValue(e.target.value)}
                  className="glass"
                  placeholder="Time"
                />
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label>End (optional)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={endDateValue}
                onChange={(e) => setEndDateValue(e.target.value)}
                className="glass"
              />
              {!allDay && (
                <Input
                  type="time"
                  value={endTimeValue}
                  onChange={(e) => setEndTimeValue(e.target.value)}
                  className="glass"
                  placeholder="Time"
                />
              )}
            </div>
          </div>

          {/* Ticketing Section */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border">
            <Label className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" />
              Ticketing
            </Label>
            
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTicketType('free')}
                className={`p-2 rounded-lg border text-center transition-all text-sm ${
                  ticketType === 'free' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                Free
              </button>
              <button
                type="button"
                onClick={() => setTicketType('paid')}
                className={`p-2 rounded-lg border text-center transition-all text-sm ${
                  ticketType === 'paid' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                Sell Tickets
              </button>
              <button
                type="button"
                onClick={() => setTicketType('external')}
                className={`p-2 rounded-lg border text-center transition-all text-sm ${
                  ticketType === 'external' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                External Link
              </button>
            </div>

            {ticketType === 'paid' && (
              <div className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Price (USD)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        value={ticketPrice}
                        onChange={(e) => setTicketPrice(e.target.value)}
                        placeholder="0.00"
                        className="glass pl-9"
                        min={0}
                        step={0.01}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">LC Credits (optional)</Label>
                    <div className="relative">
                      <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        value={creditsPrice}
                        onChange={(e) => setCreditsPrice(e.target.value)}
                        placeholder="0"
                        className="glass pl-9"
                        min={0}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {ticketType === 'external' && (
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">External Ticket Link</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="url"
                    value={externalLink}
                    onChange={(e) => setExternalLink(e.target.value)}
                    placeholder="https://eventbrite.com/..."
                    className="glass pl-9"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Notes (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any notes..."
              className="glass min-h-[60px]"
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

          {/* Google Calendar Integration */}
          <Button
            type="button"
            variant="outline"
            onClick={addToGoogleCalendar}
            className="w-full flex items-center justify-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Add to Google Calendar
          </Button>

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
