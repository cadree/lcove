import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEventWithRSVP } from "@/hooks/useCalendar";
import { zonedParts, zonedWallTimeToUtc } from "@/lib/eventTime";
import { toast } from "sonner";

interface EditCommunityEventDialogProps {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function EditCommunityEventDialog({ eventId, open, onOpenChange }: EditCommunityEventDialogProps) {
  const queryClient = useQueryClient();
  const { data: event } = useEventWithRSVP(eventId || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [recurrence, setRecurrence] = useState<string>("none");

  useEffect(() => {
    if (!event) return;
    const zone = event.timezone || "UTC";
    const start = zonedParts(event.start_date, zone);
    setTitle(event.title);
    setDescription(event.description || "");
    setVenue(event.venue || "");
    setCity(event.city);
    setTimezone(zone);
    setStartDate(`${start.year}-${pad(start.month)}-${pad(start.day)}`);
    setStartTime(`${pad(start.hour)}:${pad(start.minute)}`);
    if (event.end_date) {
      const end = zonedParts(event.end_date, zone);
      setEndDate(`${end.year}-${pad(end.month)}-${pad(end.day)}`);
      setEndTime(`${pad(end.hour)}:${pad(end.minute)}`);
    }
    setRecurrence(event.recurrence || "none");
  }, [event]);

  const save = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error("Missing event");
      const { error } = await supabase
        .from("events")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          venue: venue.trim() || null,
          city: city.trim(),
          timezone,
          start_date: zonedWallTimeToUtc(startDate, startTime, timezone),
          end_date: endDate && endTime ? zonedWallTimeToUtc(endDate, endTime, timezone) : null,
          recurrence: recurrence === "none" ? null : recurrence,
        })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      toast.success("Event updated");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit event</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Venue</Label>
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
          <div>
            <Label>City</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <div>
            <Label>Timezone</Label>
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
          </div>
          <div>
            <Label>Repeats</Label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Does not repeat</SelectItem>
                <SelectItem value="FREQ=WEEKLY">Weekly</SelectItem>
                <SelectItem value="FREQ=MONTHLY">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={save.isPending}>Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
