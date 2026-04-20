import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { sendAudienceInvite, useAudienceEstimate } from "@/hooks/useNotificationCampaigns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId?: string;
  defaultTitle?: string;
  defaultBody?: string;
}

const INTEREST_OPTIONS = ["music", "fashion", "art", "nightlife", "film", "tech", "wellness", "food", "photography", "design"];

export function InviteAudienceDialog({ open, onOpenChange, eventId, defaultTitle, defaultBody }: Props) {
  const [title, setTitle] = useState(defaultTitle || "You're invited");
  const [body, setBody] = useState(defaultBody || "Hey {first_name}, we thought you'd be into this.");
  const [cities, setCities] = useState("");
  const [states, setStates] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [genders, setGenders] = useState<string[]>([]);
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [lookalike, setLookalike] = useState(false);
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [sending, setSending] = useState(false);

  const filter = useMemo(() => ({
    cities: cities.split(",").map(s => s.trim()).filter(Boolean),
    states: states.split(",").map(s => s.trim()).filter(Boolean),
    interests,
    genders,
    age_min: ageMin ? Number(ageMin) : null,
    age_max: ageMax ? Number(ageMax) : null,
    active_only: activeOnly,
  }), [cities, states, interests, genders, ageMin, ageMax, activeOnly]);

  const { data: estimate, isLoading: estimating } = useAudienceEstimate(filter, open);

  const toggle = (arr: string[], setArr: (a: string[]) => void, v: string) =>
    setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await sendAudienceInvite({
        eventId, title, body,
        channels: { push, email },
        filter, lookalike,
      });
      toast.success(`Invite sent to ${res.recipientCount} users`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite audience</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Estimate */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {estimating ? "Calculating…" : `~${estimate ?? 0} users match`}
              </p>
              <p className="text-xs text-muted-foreground">Adjust filters to refine.</p>
            </div>
          </div>

          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cities (comma-separated)</Label>
              <Input value={cities} onChange={e => setCities(e.target.value)} placeholder="Atlanta, Miami" />
            </div>
            <div>
              <Label>States</Label>
              <Input value={states} onChange={e => setStates(e.target.value)} placeholder="GA, FL" />
            </div>
            <div>
              <Label>Min age</Label>
              <Input type="number" value={ageMin} onChange={e => setAgeMin(e.target.value)} />
            </div>
            <div>
              <Label>Max age</Label>
              <Input type="number" value={ageMax} onChange={e => setAgeMax(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Interests</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {INTEREST_OPTIONS.map(i => (
                <Badge key={i}
                  variant={interests.includes(i) ? "default" : "outline"}
                  className="cursor-pointer capitalize"
                  onClick={() => toggle(interests, setInterests, i)}>
                  {i}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Gender</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {["female", "male", "non-binary"].map(g => (
                <Badge key={g}
                  variant={genders.includes(g) ? "default" : "outline"}
                  className="cursor-pointer capitalize"
                  onClick={() => toggle(genders, setGenders, g)}>
                  {g}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/40 p-2.5">
            <div>
              <p className="text-sm font-medium">Active in last 30 days</p>
              <p className="text-xs text-muted-foreground">Higher engagement</p>
            </div>
            <Switch checked={activeOnly} onCheckedChange={setActiveOnly} />
          </div>

          {eventId && (
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Lookalike expansion</p>
                  <p className="text-xs text-muted-foreground">Add interests from current attendees</p>
                </div>
              </div>
              <Switch checked={lookalike} onCheckedChange={setLookalike} />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Channels</Label>
            <div className="flex items-center justify-between rounded-lg border border-border/40 p-2.5">
              <span className="text-sm">Push (primary)</span>
              <Switch checked={push} onCheckedChange={setPush} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/40 p-2.5">
              <span className="text-sm">Email fallback</span>
              <Switch checked={email} onCheckedChange={setEmail} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || (!push && !email)}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send to {estimate ?? 0}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
