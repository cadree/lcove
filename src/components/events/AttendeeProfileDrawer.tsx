import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Mail,
  Phone,
  MapPin,
  Copy,
  ExternalLink,
  Instagram,
  Plus,
  X,
  Send,
  Loader2,
  Ticket,
  Calendar,
  CheckCircle2,
  Clock,
  CircleDollarSign,
  TrendingUp,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AttendeeKey,
  useAddAttendeeTag,
  useAttendeeCrmProfile,
  useRemoveAttendeeTag,
  useResendReceipt,
  useSaveAttendeeNote,
} from "@/hooks/useAttendeeCrmProfile";
import { SendReminderDialog } from "@/components/events/SendReminderDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendeeKey: AttendeeKey | null;
  fallbackName?: string | null;
  eventId?: string;
}

const fmtMoney = (cents: number, currency = "usd") => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format((cents || 0) / 100);
  } catch {
    return `$${((cents || 0) / 100).toFixed(2)}`;
  }
};

const copy = (text: string, label: string) => {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`)).catch(() => toast.error("Copy failed"));
};

export function AttendeeProfileDrawer({ open, onOpenChange, attendeeKey, fallbackName, eventId }: Props) {
  const { data, isLoading, error } = useAttendeeCrmProfile(attendeeKey);
  const addTag = useAddAttendeeTag(attendeeKey || {});
  const removeTag = useRemoveAttendeeTag(attendeeKey || {});
  const saveNote = useSaveAttendeeNote(attendeeKey || {});
  const resend = useResendReceipt();

  const [tagInput, setTagInput] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSavedAt, setNoteSavedAt] = useState<number | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);

  useEffect(() => {
    setNoteDraft(data?.note?.note || "");
  }, [data?.note?.id, data?.note?.note]);

  // Autosave note (debounced)
  useEffect(() => {
    if (!attendeeKey || !data) return;
    if (noteDraft === (data.note?.note || "")) return;
    const t = setTimeout(() => {
      saveNote.mutate(noteDraft, { onSuccess: () => setNoteSavedAt(Date.now()) });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteDraft]);

  const identity = data?.identity;
  const stats = data?.stats;
  const displayName = identity?.display_name || fallbackName || identity?.email || "Attendee";
  const initial = (displayName || "?").charAt(0).toUpperCase();

  const socials: any = identity?.social_links || {};
  const instagram = socials.instagram || socials.ig;
  const genericHandle = !instagram ? (socials.handle || socials.tiktok || socials.twitter) : null;

  const handleAddTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    addTag.mutate(v, { onSuccess: () => setTagInput("") });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <SheetTitle className="sr-only">Attendee Profile</SheetTitle>
          <div className="flex items-start gap-3">
            <Avatar className="h-14 w-14">
              <AvatarImage src={identity?.avatar_url || undefined} />
              <AvatarFallback className="text-lg">{initial}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-xl font-semibold truncate">{displayName}</h2>
                {!identity?.user_id && <Badge variant="outline" className="text-[10px]">Guest</Badge>}
              </div>
              {identity?.username && (
                <p className="text-sm text-muted-foreground">@{identity.username}</p>
              )}
              {identity?.joined_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Member since {format(new Date(identity.joined_at), "MMM yyyy")}
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-5">
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {error && !isLoading && (
            <EmptyState
              icon={X}
              title="Could not load profile"
              description={(error as any)?.message || "Try again later."}
            />
          )}

          {data && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <StatCard icon={Calendar} label="Events" value={stats?.events_attended ?? 0} />
                <StatCard icon={Ticket} label="Tickets" value={stats?.tickets_purchased ?? 0} />
                <StatCard icon={CircleDollarSign} label="Lifetime spend" value={fmtMoney(stats?.lifetime_spend_cents ?? 0)} />
                <StatCard icon={TrendingUp} label="No-shows" value={stats?.no_show_count ?? 0} />
              </div>
              {stats?.last_event && (
                <p className="text-xs text-muted-foreground -mt-2">
                  Last attended <span className="text-foreground">{stats.last_event.title}</span>
                  {stats.last_event.date && <> · {format(new Date(stats.last_event.date), "MMM d, yyyy")}</>}
                </p>
              )}

              {/* Quick actions */}
              {eventId && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setReminderOpen(true)}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send reminder
                </Button>
              )}

              {/* Contact */}
              <Section title="Contact">
                <div className="space-y-2">
                  {identity?.email && (
                    <ContactRow
                      icon={Mail}
                      value={identity.email}
                      onCopy={() => copy(identity.email!, "Email")}
                      href={`mailto:${identity.email}`}
                    />
                  )}
                  {identity?.phone && (
                    <ContactRow
                      icon={Phone}
                      value={identity.phone}
                      onCopy={() => copy(identity.phone!, "Phone")}
                      href={`tel:${identity.phone}`}
                    />
                  )}
                  {identity?.city && (
                    <ContactRow icon={MapPin} value={identity.city} />
                  )}
                  {instagram && (
                    <ContactRow
                      icon={Instagram}
                      value={`@${String(instagram).replace(/^@/, "")}`}
                      href={`https://instagram.com/${String(instagram).replace(/^@/, "")}`}
                      onCopy={() => copy(`@${String(instagram).replace(/^@/, "")}`, "Handle")}
                      external
                    />
                  )}
                  {!instagram && genericHandle && (
                    <ContactRow
                      icon={Instagram}
                      value={`@${String(genericHandle).replace(/^@/, "")}`}
                      onCopy={() => copy(`@${String(genericHandle).replace(/^@/, "")}`, "Handle")}
                    />
                  )}
                  {!identity?.email && !identity?.phone && !identity?.city && !instagram && !genericHandle && (
                    <p className="text-sm text-muted-foreground">No contact info on file.</p>
                  )}
                </div>
              </Section>

              {/* Tags */}
              <Section title="Tags">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {data.tags.length === 0 && (
                    <p className="text-sm text-muted-foreground">No tags yet.</p>
                  )}
                  {data.tags.map((t) => (
                    <Badge key={t.id} variant="secondary" className="gap-1 pr-1">
                      {t.tag}
                      <button
                        onClick={() => removeTag.mutate(t.id)}
                        className="rounded-full hover:bg-background/50 p-0.5"
                        aria-label={`Remove ${t.tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                    placeholder="Add tag (e.g. VIP, Repeat)"
                    className="h-9"
                  />
                  <Button size="sm" onClick={handleAddTag} disabled={addTag.isPending || !tagInput.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </Section>

              {/* Notes */}
              <Section title="Notes" subtitle={noteSavedAt ? "Saved" : undefined}>
                <Textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Private notes about this attendee…"
                  className="min-h-[90px] text-sm placeholder:text-left"
                />
              </Section>

              {/* Order history */}
              <Section title={`Orders (${data.orders.length})`}>
                {data.orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.orders.map((o) => {
                      const isRefunded = !!o.refunded_at || (o.refund_amount_cents || 0) > 0;
                      const isPaid = ["paid", "succeeded", "complete", "completed"].includes(o.payment_status);
                      return (
                        <Card key={o.id} className="border-border/40 bg-card/60">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">{o.event_title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {o.quantity} ticket{o.quantity > 1 ? "s" : ""} ·{" "}
                                  {format(new Date(o.created_at), "MMM d, yyyy")}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-semibold">{fmtMoney(o.total_cents, o.currency)}</p>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] mt-0.5",
                                    isRefunded
                                      ? "bg-muted text-muted-foreground"
                                      : isPaid
                                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                      : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                  )}
                                >
                                  {isRefunded ? "Refunded" : o.payment_status}
                                </Badge>
                              </div>
                            </div>
                            <div className="mt-2 flex gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => resend.mutate(o.id)}
                                disabled={resend.isPending}
                              >
                                {resend.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                                Resend
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => copy(o.id, "Order ID")}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Order ID
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* Event history */}
              <Section title={`Event history (${data.events.length})`}>
                {data.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No event history.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.events.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/30 last:border-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{e.event_title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {e.event_date && format(new Date(e.event_date), "MMM d, yyyy")}
                            {e.tier_name && <> · {e.tier_name}</>}
                          </p>
                        </div>
                        {e.status === "checked_in" ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Checked in
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[10px]">
                            <Clock className="h-3 w-3 mr-1" />
                            {e.status}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </SheetContent>

      {eventId && (
        <SendReminderDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          eventId={eventId}
          attendee={{
            name: identity?.display_name || fallbackName,
            email: identity?.email || null,
            user_id: identity?.user_id || null,
            phone: identity?.phone || null,
          }}
        />
      )}
    </Sheet>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <Card className="border-border/40 bg-card/60">
      <CardContent className="p-3 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold leading-tight truncate">{value}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ContactRow({
  icon: Icon,
  value,
  href,
  external,
  onCopy,
}: {
  icon: any;
  value: string;
  href?: string;
  external?: boolean;
  onCopy?: () => void;
}) {
  const inner = (
    <span className="text-sm truncate flex-1">{value}</span>
  );
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      {href ? (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className="flex-1 min-w-0 hover:text-primary transition-colors"
        >
          {inner}
        </a>
      ) : (
        <div className="flex-1 min-w-0">{inner}</div>
      )}
      {external && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
      {onCopy && (
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCopy}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
