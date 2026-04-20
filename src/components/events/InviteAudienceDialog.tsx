import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Sparkles, MapPin, Users, Image as ImageIcon, X, Plus, FileText, FileVideo, File as FileIcon, Presentation, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { sendAudienceInvite, useAudienceEstimate, useAudiencePreview } from "@/hooks/useNotificationCampaigns";
import { useAuth } from "@/contexts/AuthContext";
import { useEventMoodboard, useAddMoodboardItem, useDeleteMoodboardItem, uploadMoodboardFile, classifyFile, type MoodboardFileType } from "@/hooks/useEventMoodboard";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

function formatActivity(iso: string | null): string {
  if (!iso) return "No recent activity";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "No recent activity";
  return `Active ${formatDistanceToNow(d, { addSuffix: true })}`;
}

function fileTypeMeta(t: MoodboardFileType | null) {
  switch (t) {
    case "video": return { Icon: FileVideo, label: "Video" };
    case "pdf": return { Icon: FileText, label: "PDF" };
    case "presentation": return { Icon: Presentation, label: "Slides" };
    case "doc": return { Icon: FileText, label: "Doc" };
    default: return { Icon: FileIcon, label: "File" };
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId?: string;
  eventName?: string;
  eventCity?: string;
}

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];

const INTEREST_OPTIONS = ["music", "fashion", "art", "nightlife", "film", "tech", "wellness", "food", "photography", "design"];

const TEMPLATES = [
  { id: "blank", label: "Blank", title: "You're invited", body: "Hey {first_name}, we thought you'd be into this." },
  { id: "vibe", label: "Set the vibe", title: "Something special is happening", body: "Hey {first_name} — we're putting together something you'd love. Tap to RSVP." },
  { id: "exclusive", label: "Exclusive", title: "You're on the list", body: "{first_name}, this one's invite-only. We saved a spot for you." },
  { id: "lastcall", label: "Last call", title: "Don't sleep on this", body: "Hey {first_name}, spots are going fast. Lock in yours now." },
];

type LocationMode = "anywhere" | "near" | "states";
type AgeMode = "all" | "18" | "21" | "custom";
type AudienceType = "everyone" | "similar" | "active";

export function InviteAudienceDialog({ open, onOpenChange, eventId, eventName, eventCity }: Props) {
  const { user } = useAuth();

  // Audience config
  const [audienceType, setAudienceType] = useState<AudienceType>("everyone");
  const [locationMode, setLocationMode] = useState<LocationMode>("anywhere");
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [ageMode, setAgeMode] = useState<AgeMode>("all");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [smartMatch, setSmartMatch] = useState(true);
  const [interests, setInterests] = useState<string[]>([]);
  const [showRefine, setShowRefine] = useState(false);

  // Message
  const [template, setTemplate] = useState("blank");
  const [title, setTitle] = useState("You're invited");
  const [body, setBody] = useState("Hey {first_name}, we thought you'd be into this.");
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [sending, setSending] = useState(false);

  // Moodboard
  const { data: moodboard = [] } = useEventMoodboard(eventId);
  const addMood = useAddMoodboardItem();
  const delMood = useDeleteMoodboardItem();
  const [vibeText, setVibeText] = useState("");
  const [uploadingMood, setUploadingMood] = useState(false);

  useEffect(() => {
    const t = TEMPLATES.find(x => x.id === template);
    if (t && template !== "blank") {
      setTitle(t.title);
      setBody(t.body);
    }
  }, [template]);

  // Resolve filter from simplified controls
  const filter = useMemo(() => {
    const ageBuckets: Record<AgeMode, { min: number | null; max: number | null }> = {
      all: { min: null, max: null },
      "18": { min: 18, max: null },
      "21": { min: 21, max: null },
      custom: { min: ageMin ? Number(ageMin) : null, max: ageMax ? Number(ageMax) : null },
    };
    const ages = ageBuckets[ageMode];

    let states: string[] = [];
    if (locationMode === "states") states = selectedStates;
    if (locationMode === "near" && eventCity) {
      // Heuristic: extract trailing ", XX" state code from event city
      const m = eventCity.match(/,\s*([A-Z]{2})\s*$/);
      if (m) states = [m[1]];
    }

    return {
      states,
      interests: smartMatch ? [] : interests, // smart match relaxes strict matching
      lookalike: audienceType === "similar",
      active_only: audienceType === "active",
      age_min: ages.min,
      age_max: ages.max,
    };
  }, [audienceType, locationMode, selectedStates, eventCity, ageMode, ageMin, ageMax, smartMatch, interests]);

  const { data: estimate, isFetching: estimating } = useAudienceEstimate(filter, open);
  const { data: previewUsers = [], isFetching: previewing } = useAudiencePreview(filter, open, 10);

  const toggleArr = (arr: string[], setArr: (a: string[]) => void, v: string) =>
    setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const handleMoodUpload = async (file: File) => {
    if (!user || !eventId) return;
    setUploadingMood(true);
    try {
      const url = await uploadMoodboardFile(user.id, eventId, file);
      const fileType = classifyFile(file);
      await addMood.mutateAsync({
        event_id: eventId,
        type: fileType === "image" ? "image" : "file",
        media_url: url,
        link_url: null,
        title: null,
        body: null,
        start_time: null,
        sort_order: moodboard.length,
        file_type: fileType,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
      });
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploadingMood(false);
    }
  };

  const handleAddVibe = async () => {
    if (!eventId || !vibeText.trim()) return;
    await addMood.mutateAsync({
      event_id: eventId, type: "note", media_url: null, link_url: null,
      title: "Vibe", body: vibeText.trim(), start_time: null, sort_order: moodboard.length,
    });
    setVibeText("");
  };

  const handleSend = async () => {
    setSending(true);
    try {
      // Auto-insert event link by appending to body if not present
      const eventLink = eventId ? `https://etherbylcove.com/event/${eventId}` : "";
      const finalBody = eventLink && !body.includes(eventLink) ? `${body}\n\n${eventLink}` : body;

      const res = await sendAudienceInvite({
        eventId, title, body: finalBody,
        channels: { push, email },
        filter: {
          states: filter.states,
          interests: filter.interests,
          age_min: filter.age_min,
          age_max: filter.age_max,
          active_only: filter.active_only,
        },
        lookalike: filter.lookalike,
      });
      toast.success(`Invite sent to ${res.recipientCount} users`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const eventLinkSnippet = eventId ? `https://etherbylcove.com/event/${eventId}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-4 border-b border-border/40 sticky top-0 bg-background z-10">
          <DialogHeader>
            <DialogTitle className="text-xl">Invite audience</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Pick who → see them → send.</p>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* HERO REACH */}
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Estimated reach</p>
            <div
              key={estimate ?? 0}
              className={cn("text-5xl font-display font-bold mt-1 tabular-nums", "animate-scale-in")}
            >
              {estimating ? "…" : (estimate ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">people will see this invite</p>
          </div>

          {/* AUDIENCE TYPE */}
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Audience</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "everyone", label: "Everyone", icon: Users },
                { v: "similar", label: "Similar to attendees", icon: Sparkles },
                { v: "active", label: "Active (30d)", icon: Sparkles },
              ] as const).map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setAudienceType(opt.v)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all",
                    audienceType === opt.v
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border/40 hover:border-border bg-card/40"
                  )}
                >
                  <opt.icon className="h-4 w-4 text-primary mb-1.5" />
                  <p className="text-sm font-medium">{opt.label}</p>
                </button>
              ))}
            </div>
            {audienceType === "similar" && !eventId && (
              <p className="text-xs text-muted-foreground">Tip: this works best on an event with attendees.</p>
            )}
          </section>

          {/* LOCATION */}
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Location</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "anywhere", label: "Anywhere" },
                { v: "near", label: "Near event" },
                { v: "states", label: "Select states" },
              ] as const).map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setLocationMode(opt.v)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-1.5",
                    locationMode === opt.v
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border/40 hover:border-border"
                  )}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>
            {locationMode === "states" && (
              <div className="flex flex-wrap gap-1.5 pt-2 max-h-32 overflow-y-auto">
                {US_STATES.map(s => (
                  <Badge
                    key={s}
                    variant={selectedStates.includes(s) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleArr(selectedStates, setSelectedStates, s)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            )}
            {locationMode === "near" && eventCity && (
              <p className="text-xs text-muted-foreground">Targeting users near <span className="text-foreground font-medium">{eventCity}</span>.</p>
            )}
          </section>

          {/* AGE */}
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Age</Label>
            <div className="grid grid-cols-4 gap-2">
              {([
                { v: "all", label: "All ages" },
                { v: "18", label: "18+" },
                { v: "21", label: "21+" },
                { v: "custom", label: "Custom" },
              ] as const).map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setAgeMode(opt.v)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                    ageMode === opt.v
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border/40 hover:border-border"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {ageMode === "custom" && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Input type="number" placeholder="Min age" value={ageMin} onChange={e => setAgeMin(e.target.value)} />
                <Input type="number" placeholder="Max age" value={ageMax} onChange={e => setAgeMax(e.target.value)} />
              </div>
            )}
          </section>

          {/* SMART MATCH */}
          <section className="rounded-xl border border-border/40 p-3 flex items-center justify-between">
            <div className="flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">Smart Match</p>
                <p className="text-xs text-muted-foreground">Use behavior, RSVPs, and engagement instead of strict tags.</p>
              </div>
            </div>
            <Switch checked={smartMatch} onCheckedChange={setSmartMatch} />
          </section>

          {!smartMatch && (
            <section className="space-y-2">
              <button
                type="button"
                onClick={() => setShowRefine(s => !s)}
                className="text-xs text-primary hover:underline"
              >
                {showRefine ? "Hide" : "Refine with"} interests (optional)
              </button>
              {showRefine && (
                <div className="flex flex-wrap gap-1.5">
                  {INTEREST_OPTIONS.map(i => (
                    <Badge
                      key={i}
                      variant={interests.includes(i) ? "default" : "outline"}
                      className="cursor-pointer capitalize"
                      onClick={() => toggleArr(interests, setInterests, i)}
                    >
                      {i}
                    </Badge>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* LIVE PREVIEW */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Who you'll reach</Label>
              {previewing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {previewUsers.length === 0 && !previewing ? (
              <div className="rounded-xl border border-dashed border-border/40 p-6 text-center text-sm text-muted-foreground">
                No users match yet. Try widening filters.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {previewUsers.slice(0, 9).map(u => (
                  <div key={u.user_id} className="rounded-xl border border-border/40 bg-card/40 p-2.5 animate-fade-in">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{(u.display_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{u.display_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {formatActivity(u.last_active_at)}
                        </p>
                      </div>
                    </div>
                    {u.interests && u.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {u.interests.slice(0, 2).map(i => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">{i}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* MOODBOARD */}
          {eventId && (
            <section className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Event moodboard</Label>
              <p className="text-xs text-muted-foreground -mt-1">Set the vibe attendees will see.</p>

              {/* Image carousel */}
              {moodboard.filter(m => m.type === "image").length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {moodboard.filter(m => m.type === "image").map(m => (
                    <div key={m.id} className="relative flex-shrink-0 group">
                      <img src={m.media_url!} className="h-24 w-24 rounded-lg object-cover" alt="" />
                      <button
                        type="button"
                        onClick={() => delMood.mutate({ id: m.id, eventId })}
                        className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Non-image file cards */}
              {moodboard.filter(m => m.type === "file").length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {moodboard.filter(m => m.type === "file").map(m => {
                    const { Icon, label } = fileTypeMeta(m.file_type);
                    return (
                      <a
                        key={m.id}
                        href={m.media_url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative flex items-center gap-2 rounded-xl border border-border/40 bg-card/40 p-2.5 hover:border-border transition-colors"
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{m.file_name || "File"}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); delMood.mutate({ id: m.id, eventId }); }}
                          className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </a>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-border/40 hover:border-primary/50 p-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2 transition-colors">
                  {uploadingMood ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  Add image, PDF, video, or doc
                  <input
                    type="file"
                    accept="image/*,video/*,application/pdf,.doc,.docx,.ppt,.pptx,.txt"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleMoodUpload(f); e.target.value = ""; }}
                  />
                </label>
              </div>

              {/* Vibe text */}
              <div className="flex gap-2">
                <Input
                  placeholder="Event vibe (e.g. low-lit, jazz, intimate)"
                  value={vibeText}
                  onChange={e => setVibeText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddVibe(); } }}
                />
                <Button size="icon" variant="outline" onClick={handleAddVibe} disabled={!vibeText.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {moodboard.filter(m => m.type === "note").length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {moodboard.filter(m => m.type === "note").map(m => (
                    <Badge key={m.id} variant="secondary" className="cursor-pointer" onClick={() => delMood.mutate({ id: m.id, eventId })}>
                      {m.body} <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* MESSAGE */}
          <section className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Message</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" />
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Message ({first_name} supported)" />
            {eventLinkSnippet && (
              <p className="text-[10px] text-muted-foreground">Event link will be auto-attached: {eventLinkSnippet}</p>
            )}

            {/* Invite preview */}
            <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Preview</p>
              <p className="text-sm font-semibold">{title.replace("{first_name}", "Alex")}</p>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{body.replace("{first_name}", "Alex")}</p>
              {eventName && <p className="text-[10px] text-primary">→ {eventName}</p>}
            </div>

            {/* Channels */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPush(!push)}
                className={cn("rounded-xl border px-3 py-2 text-sm transition-all",
                  push ? "border-primary bg-primary/10" : "border-border/40")}
              >
                Push {push && "✓"}
              </button>
              <button
                type="button"
                onClick={() => setEmail(!email)}
                className={cn("rounded-xl border px-3 py-2 text-sm transition-all",
                  email ? "border-primary bg-primary/10" : "border-border/40")}
              >
                Email {email && "✓"}
              </button>
            </div>
          </section>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 sticky bottom-0 bg-background">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || (!push && !email) || !estimate}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send to {estimate ?? 0}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
