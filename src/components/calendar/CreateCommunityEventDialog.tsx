import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useCreateEvent } from "@/hooks/useCalendar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  Upload, 
  X, 
  Calendar, 
  DollarSign, 
  Link as LinkIcon, 
  Ticket, 
  Coins,
  MapPin,
  Users,
  Globe
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateCommunityEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
}

type TicketType = 'free' | 'paid' | 'credits' | 'hybrid' | 'info';

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 
  'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 
  'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
  'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming'
];

export function CreateCommunityEventDialog({ 
  open, 
  onOpenChange, 
  defaultDate 
}: CreateCommunityEventDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createEvent = useCreateEvent();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [startDateValue, setStartDateValue] = useState(
    defaultDate ? format(defaultDate, "yyyy-MM-dd") : ''
  );
  const [startTimeValue, setStartTimeValue] = useState('');
  const [endDateValue, setEndDateValue] = useState(
    defaultDate ? format(defaultDate, "yyyy-MM-dd") : ''
  );
  const [endTimeValue, setEndTimeValue] = useState('');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
  );
  const [capacity, setCapacity] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  
  // Image upload
  const [imageUrl, setImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Ticketing
  const [ticketType, setTicketType] = useState<TicketType>('free');
  const [ticketPrice, setTicketPrice] = useState('');
  const [creditsPrice, setCreditsPrice] = useState('');
  const [externalUrl, setExternalUrl] = useState('');

// Common timezones for selection
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
  { value: 'UTC', label: 'UTC' },
];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

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
      const filePath = `${user.id}/event-images/${fileName}`;

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
      toast.error('Please log in to create events');
      return;
    }

    if (!title.trim()) {
      toast.error('Please enter an event title');
      return;
    }

    if (!city.trim()) {
      toast.error('Please enter a city');
      return;
    }

    if (!startDateValue || !startTimeValue) {
      toast.error('Please select a start date and time');
      return;
    }

    if (!endDateValue || !endTimeValue) {
      toast.error('Please select an end date and time');
      return;
    }

    // Combine date and time
    const startDateTime = `${startDateValue}T${startTimeValue}:00`;
    const endDateTime = `${endDateValue}T${endTimeValue}:00`;

    createEvent.mutate({
      title: title.trim(),
      description: description.trim() || null,
      venue: venue.trim() || null,
      address: address.trim() || null,
      city: city.trim(),
      state: state || null,
      country: 'USA',
      start_date: new Date(startDateTime).toISOString(),
      end_date: new Date(endDateTime).toISOString(),
      timezone,
      image_url: imageUrl || null,
      ticket_type: ticketType,
      ticket_price: ticketType === 'paid' || ticketType === 'hybrid' ? parseFloat(ticketPrice) || null : null,
      credits_price: ticketType === 'credits' || ticketType === 'hybrid' ? parseInt(creditsPrice) || null : null,
      capacity: capacity ? parseInt(capacity) : null,
      is_public: isPublic,
      external_url: ticketType === 'info' ? externalUrl || null : null,
      project_id: null,
    }, {
      onSuccess: () => {
        toast.success('Event created! It will now be visible to the community.');
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

    const startDateTime = `${startDateValue.replace(/-/g, '')}T${(startTimeValue || '00:00').replace(':', '')}00`;
    const endDateTime = endDateValue
      ? `${endDateValue.replace(/-/g, '')}T${(endTimeValue || '23:59').replace(':', '')}00`
      : startDateTime;

    const googleCalendarUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalendarUrl.searchParams.set('action', 'TEMPLATE');
    googleCalendarUrl.searchParams.set('text', title);
    googleCalendarUrl.searchParams.set('dates', `${startDateTime}/${endDateTime}`);
    
    if (description) {
      googleCalendarUrl.searchParams.set('details', description);
    }
    if (venue || address || city) {
      const location = [venue, address, city, state].filter(Boolean).join(', ');
      googleCalendarUrl.searchParams.set('location', location);
    }

    window.open(googleCalendarUrl.toString(), '_blank');
    toast.success('Opening Google Calendar...');
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setVenue('');
    setAddress('');
    setCity('');
    setState('');
    setStartDateValue('');
    setStartTimeValue('');
    setEndDateValue('');
    setEndTimeValue('');
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York');
    setCapacity('');
    setIsPublic(true);
    setImageUrl('');
    setTicketType('free');
    setTicketPrice('');
    setCreditsPrice('');
    setExternalUrl('');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="glass-strong border-border/30 max-h-[90vh] overflow-y-auto pb-24 sm:pb-6 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Create Community Event
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Image */}
          <div className="space-y-2">
            <Label>Event Image</Label>
            {imageUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img 
                  src={imageUrl} 
                  alt="Event" 
                  className="w-full h-40 object-cover"
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
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  {isUploadingImage ? 'Uploading...' : 'Upload event cover image'}
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
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's the event called?"
              className="glass"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell people what to expect..."
              className="glass min-h-[80px]"
            />
          </div>

          {/* Location */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Location
            </Label>
            
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Venue Name (optional)</Label>
                <Input
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g., The Grand Hall"
                  className="glass"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Address (optional)</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g., 123 Main St"
                  className="glass"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">City *</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="glass"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">State</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger className="glass">
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Date & Time
            </Label>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Start Date & Time *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={startDateValue}
                    onChange={(e) => setStartDateValue(e.target.value)}
                    className="glass"
                    required
                  />
                  <Input
                    type="time"
                    value={startTimeValue}
                    onChange={(e) => setStartTimeValue(e.target.value)}
                    className="glass"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">End Date & Time *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={endDateValue}
                    onChange={(e) => setEndDateValue(e.target.value)}
                    className="glass"
                    required
                  />
                  <Input
                    type="time"
                    value={endTimeValue}
                    onChange={(e) => setEndTimeValue(e.target.value)}
                    className="glass"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Timezone *</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="glass">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Capacity */}
          <div className="space-y-2">
            <Label htmlFor="capacity" className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Capacity (optional)
            </Label>
            <Input
              id="capacity"
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Leave blank for unlimited"
              className="glass"
              min={1}
            />
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
                Paid
              </button>
              <button
                type="button"
                onClick={() => setTicketType('info')}
                className={`p-2 rounded-lg border text-center transition-all text-sm ${
                  ticketType === 'info' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                External Link
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTicketType('credits')}
                className={`p-2 rounded-lg border text-center transition-all text-sm ${
                  ticketType === 'credits' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                Credits Only
              </button>
              <button
                type="button"
                onClick={() => setTicketType('hybrid')}
                className={`p-2 rounded-lg border text-center transition-all text-sm ${
                  ticketType === 'hybrid' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                $ or Credits
              </button>
            </div>

            {(ticketType === 'paid' || ticketType === 'hybrid') && (
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Ticket Price (USD)</Label>
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
            )}

            {(ticketType === 'credits' || ticketType === 'hybrid') && (
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">LC Credits Price</Label>
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
            )}

            {ticketType === 'info' && (
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">External Ticket/Info Link</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://eventbrite.com/..."
                    className="glass pl-9"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Visibility */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border">
            <div>
              <Label htmlFor="public" className="font-medium">Public Event</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Anyone can see and RSVP to this event
              </p>
            </div>
            <Switch
              id="public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>

          {/* Google Calendar Integration */}
          <Button
            type="button"
            variant="outline"
            onClick={addToGoogleCalendar}
            className="w-full flex items-center justify-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Also Add to Google Calendar
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
              disabled={createEvent.isPending}
              className="flex-1"
            >
              {createEvent.isPending ? 'Creating...' : 'Create Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}