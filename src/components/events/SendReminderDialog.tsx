import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { sendIndividualReminder } from "@/hooks/useNotificationCampaigns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  attendee: {
    name?: string | null;
    email?: string | null;
    user_id?: string | null;
    phone?: string | null;
    tier_name?: string | null;
  };
}

const TEMPLATES = [
  { label: "Confirmed", title: "Your RSVP for {event_name} is confirmed", body: "Hey {first_name}, see you on {event_time}!" },
  { label: "2-hour warning", title: "{event_name} starts soon", body: "Hey {first_name}, {event_name} starts in 2 hours at {event_time}. Don't be late!" },
  { label: "Last call", title: "Last call — {event_name}", body: "Hey {first_name}, this is your final reminder for {event_name} on {event_time}." },
];

const VARS = ["{first_name}", "{event_name}", "{event_time}", "{ticket_type}"];

export function SendReminderDialog({ open, onOpenChange, eventId, attendee }: Props) {
  const [title, setTitle] = useState(TEMPLATES[0].title);
  const [body, setBody] = useState(TEMPLATES[0].body);
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(TEMPLATES[0].title);
      setBody(TEMPLATES[0].body);
      setPush(!!attendee.user_id);
      setEmail(!!attendee.email);
      setSms(false);
    }
  }, [open, attendee.user_id, attendee.email]);

  const insertVar = (v: string) => setBody(b => b + v);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await sendIndividualReminder({
        eventId,
        attendeeEmail: attendee.email,
        attendeeUserId: attendee.user_id,
        attendeeName: attendee.name,
        attendeePhone: attendee.phone,
        tierName: attendee.tier_name,
        channels: { push, email, sms },
        title, body,
      });
      const sent = Object.values(res?.results || {}).filter(Boolean).length;
      toast.success(`Reminder sent (${sent} channel${sent !== 1 ? "s" : ""})`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send reminder to {attendee.name || attendee.email || "attendee"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Quick templates</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {TEMPLATES.map(t => (
                <Button key={t.label} size="sm" variant="outline" onClick={() => { setTitle(t.title); setBody(t.body); }}>
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <Label>Message</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={4} />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {VARS.map(v => (
                <Badge key={v} variant="secondary" className="cursor-pointer text-[10px]" onClick={() => insertVar(v)}>{v}</Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Channels</Label>
            <div className="flex items-center justify-between rounded-lg border border-border/40 p-2.5">
              <div>
                <p className="text-sm font-medium">Push notification</p>
                <p className="text-xs text-muted-foreground">{attendee.user_id ? "Available" : "Not an Ether user"}</p>
              </div>
              <Switch checked={push} onCheckedChange={setPush} disabled={!attendee.user_id} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/40 p-2.5">
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-muted-foreground">{attendee.email || "No email on file"}</p>
              </div>
              <Switch checked={email} onCheckedChange={setEmail} disabled={!attendee.email} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/40 p-2.5">
              <div>
                <p className="text-sm font-medium">SMS</p>
                <p className="text-xs text-muted-foreground">{attendee.phone || "No phone on file"}</p>
              </div>
              <Switch checked={sms} onCheckedChange={setSms} disabled={!attendee.phone} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || (!push && !email && !sms)}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
