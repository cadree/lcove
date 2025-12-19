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
import { useDeletePersonalItem, PersonalCalendarItem } from "@/hooks/useCalendar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Trash2, 
  Edit2, 
  CalendarPlus,
  ExternalLink,
  Loader2,
  Save
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PersonalEventDetailDialogProps {
  item: PersonalCalendarItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PersonalEventDetailDialog({ 
  item, 
  open, 
  onOpenChange 
}: PersonalEventDetailDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const deleteItem = useDeletePersonalItem();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Edit form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDateValue, setStartDateValue] = useState('');
  const [startTimeValue, setStartTimeValue] = useState('');
  const [endDateValue, setEndDateValue] = useState('');
  const [endTimeValue, setEndTimeValue] = useState('');
  const [allDay, setAllDay] = useState(false);

  // Initialize form when item changes
  const initializeForm = () => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || '');
      setLocation(item.location || '');
      setAllDay(item.all_day || false);
      
      const startDate = new Date(item.start_date);
      setStartDateValue(format(startDate, 'yyyy-MM-dd'));
      setStartTimeValue(format(startDate, 'HH:mm'));
      
      if (item.end_date) {
        const endDate = new Date(item.end_date);
        setEndDateValue(format(endDate, 'yyyy-MM-dd'));
        setEndTimeValue(format(endDate, 'HH:mm'));
      } else {
        setEndDateValue('');
        setEndTimeValue('');
      }
    }
  };

  const handleEdit = () => {
    initializeForm();
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!item || !user) return;

    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    setIsSaving(true);
    try {
      const startDateTime = allDay 
        ? `${startDateValue}T00:00:00`
        : `${startDateValue}T${startTimeValue || '00:00'}:00`;
      
      const endDateTime = endDateValue
        ? (allDay ? `${endDateValue}T23:59:59` : `${endDateValue}T${endTimeValue || '23:59'}:00`)
        : null;

      const { error } = await supabase
        .from('personal_calendar_items')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          start_date: new Date(startDateTime).toISOString(),
          end_date: endDateTime ? new Date(endDateTime).toISOString() : null,
          all_day: allDay,
        })
        .eq('id', item.id)
        .eq('user_id', user.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['personal-calendar-items'] });
      toast.success('Event updated');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!item) return;
    
    deleteItem.mutate(item.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        onOpenChange(false);
      }
    });
  };

  const generateCalendarUrl = (type: 'google' | 'apple' | 'outlook') => {
    if (!item) return '';
    
    const startDate = new Date(item.start_date);
    const endDate = item.end_date ? new Date(item.end_date) : new Date(startDate.getTime() + 60 * 60 * 1000);
    
    const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d{3}/g, '');
    
    const eventTitle = encodeURIComponent(item.title);
    const eventLocation = encodeURIComponent(item.location || '');
    const details = encodeURIComponent(item.description || '');

    if (type === 'google') {
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${formatDate(startDate)}/${formatDate(endDate)}&location=${eventLocation}&details=${details}`;
    }
    
    if (type === 'outlook') {
      return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${eventTitle}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&location=${eventLocation}&body=${details}`;
    }

    // Apple Calendar uses ICS format
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${item.title}
LOCATION:${item.location || ''}
DESCRIPTION:${item.description || ''}
END:VEVENT
END:VCALENDAR`;
    
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
  };

  const handleAddToCalendar = (type: 'google' | 'apple' | 'outlook') => {
    const url = generateCalendarUrl(type);
    
    if (type === 'apple') {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${item?.title.replace(/\s+/g, '-')}.ics`;
      link.click();
    } else {
      window.open(url, '_blank');
    }
    
    toast.success('Opening calendar...');
  };

  if (!item) {
    return null;
  }

  const eventDate = new Date(item.start_date);

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setIsEditing(false);
        }
        onOpenChange(isOpen);
      }}>
        <DialogContent className="glass-strong border-border/30 max-w-md">
          <DialogHeader className="flex flex-row items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="font-display text-xl">
                {isEditing ? 'Edit Event' : item.title}
              </DialogTitle>
              {!isEditing && (
                <p className="text-sm text-muted-foreground mt-1">Personal Reminder</p>
              )}
            </div>
            
            {!isEditing && (
              <div className="flex gap-1 shrink-0">
                {/* Add to Calendar */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <CalendarPlus className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-strong border-border/30">
                    <DropdownMenuItem onClick={() => handleAddToCalendar('google')}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Google Calendar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddToCalendar('apple')}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Apple Calendar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddToCalendar('outlook')}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Outlook
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Edit */}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleEdit}>
                  <Edit2 className="w-4 h-4" />
                </Button>

                {/* Delete */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </DialogHeader>

          {isEditing ? (
            /* Edit Form */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="glass"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Where is this?"
                  className="glass"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="edit-all-day">All Day Event</Label>
                <Switch
                  id="edit-all-day"
                  checked={allDay}
                  onCheckedChange={setAllDay}
                />
              </div>

              <div className="space-y-2">
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
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
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
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Notes</Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="glass min-h-[60px]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="glass"
                  onClick={handleCancelEdit}
                  className="flex-1"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  className="flex-1"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            /* View Mode */
            <div className="space-y-4">
              {/* Date & Time */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-foreground font-medium">
                    {format(eventDate, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.all_day ? 'All day' : format(eventDate, 'h:mm a')}
                    {item.end_date && !item.all_day && ` - ${format(new Date(item.end_date), 'h:mm a')}`}
                  </p>
                </div>
              </div>

              {/* Location */}
              {item.location && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-foreground font-medium">{item.location}</p>
                  </div>
                </div>
              )}

              {/* Reminder */}
              {item.reminder_minutes && item.reminder_minutes > 0 && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-foreground font-medium">
                      Reminder: {item.reminder_minutes >= 60 
                        ? `${item.reminder_minutes / 60} hour${item.reminder_minutes >= 120 ? 's' : ''} before`
                        : `${item.reminder_minutes} minutes before`
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Description */}
              {item.description && (
                <div className="pt-4 border-t border-border/30">
                  <h4 className="text-sm font-medium text-foreground mb-2">Notes</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-strong border-border/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{item.title}" from your calendar. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteItem.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}