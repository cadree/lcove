import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { sendBulkReminder } from "@/hooks/useNotificationCampaigns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  tiers: Array<{ id: string; name: string }>;
}

export function BulkReminderDialog({ open, onOpenChange, eventId, tiers }: Props) {
  const [title, setTitle] = useState("Reminder: {event_name}");
  const [body, setBody] = useState("Hey {first_name}, just a reminder — {event_name} is coming up on {event_time}.");
  const [tierIds, setTierIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>(["confirmed"]);
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const [sending, setSending] = useState(false);

  const toggle = (arr: string[], setArr: (a: string[]) => void, v: string) =>
    setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await sendBulkReminder({
        eventId, title, body,
        channels: { push, email, sms },
        filter: { tierIds: tierIds.length ? tierIds : undefined, status: statuses },
      });
      toast.success(`Reminder queued for ${res.recipientCount} attendees`);
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
        <DialogHeader><DialogTitle>Remind attendees</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={4} />
          </div>

          {tiers.length > 0 && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ticket tiers (empty = all)</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {tiers.map(t => (
                  <Badge key={t.id}
                    variant={tierIds.includes(t.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggle(tierIds, setTierIds, t.id)}>
                    {t.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {["confirmed", "checked_in"].map(s => (
                <Badge key={s}
                  variant={statuses.includes(s) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggle(statuses, setStatuses, s)}>
                  {s.replace("_", " ")}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Channels</Label>
            <div className="flex items-center justify-between rounded-lg border border-border/40 p-2.5">
              <span className="text-sm">Push</span>
              <Switch checked={push} onCheckedChange={setPush} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/40 p-2.5">
              <span className="text-sm">Email</span>
              <Switch checked={email} onCheckedChange={setEmail} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/40 p-2.5">
              <span className="text-sm">SMS</span>
              <Switch checked={sms} onCheckedChange={setSms} />
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
