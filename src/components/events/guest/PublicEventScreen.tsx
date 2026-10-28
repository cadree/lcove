import type { ReactNode } from "react";
import { ArrowLeft, Bookmark, Calendar, Flag, MapPin, MessageCircle, Share2, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { flyerFontFamily, goingCountLabel, guestlistLine } from "@/lib/guestEvent";
import { PoweredByEther } from "./PoweredByEther";

export interface PublicEventModel {
  title: string;
  summary: string | null;
  flyerUrl: string | null;
  fontId: string | null;
  theme: "light" | "dark";
  brandColor: string | null;
  whenLabel: string;
  venue: string | null;
  area: string | null;
  ticketBadge: string;
  addressHidden: boolean;
  location: string | null;
  hostName: string;
  hostAvatar: string | null;
  hostEvents: number;
  hostAttendees: number;
  guestNames: string[];
  guestAvatars: (string | null)[];
  going: number;
  cta: string;
  saved: boolean;
  past: boolean;
}

interface Props {
  model: PublicEventModel;
  onBack: () => void;
  onSave: () => void;
  onShare: () => void;
  onLocation: () => void;
  onGuestlist: () => void;
  onFollow: () => void;
  following: boolean;
  onCalendar: () => void;
  onContact: () => void;
  onReport: () => void;
  onCta: () => void;
  reminder?: ReactNode;
  hostShare?: ReactNode;
  details?: ReactNode;
}

export function PublicEventScreen({
  model, onBack, onSave, onShare, onLocation, onGuestlist, onFollow, following, onCalendar, onContact, onReport, onCta, reminder, hostShare, details,
}: Props) {
  const ctaStyle = model.brandColor ? { backgroundColor: model.brandColor, color: "#1a1020" } : undefined;
  return (
    <div className={model.theme === "light" ? "light min-h-screen bg-background text-foreground" : "min-h-screen bg-background text-foreground"}>
      <div className="relative min-h-[70vh] bg-card">
        {model.flyerUrl ? (
          <img src={model.flyerUrl} alt={model.title} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-card to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-black/30" />
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),12px)]">
          <IconButton label="Back" onClick={onBack}><ArrowLeft className="h-5 w-5" /></IconButton>
          <div className="flex gap-2">
            <IconButton label={model.saved ? "Saved" : "Save"} onClick={onSave}>
              <Bookmark className={`h-5 w-5 ${model.saved ? "fill-current" : ""}`} />
            </IconButton>
            <IconButton label="Share" onClick={onShare}><Share2 className="h-5 w-5" /></IconButton>
          </div>
        </div>
      </div>

      <div className="relative z-10 -mt-16 space-y-5 px-4 pb-28">
        <h1 className="text-4xl leading-none" style={{ fontFamily: flyerFontFamily(model.fontId) }}>{model.title}</h1>
        <span className="inline-flex rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium">{model.ticketBadge}</span>
        {hostShare}
        <p className="text-sm text-muted-foreground">{model.whenLabel}</p>
        {model.venue && <p className="text-base">{model.venue}</p>}
        {model.area && <p className="text-sm text-muted-foreground">{model.area}</p>}
        <button type="button" className="inline-flex items-center gap-2 text-sm text-primary" onClick={onLocation}>
          <MapPin className="h-4 w-4" />
          {model.addressHidden && !model.location ? "Hidden until you RSVP" : "View location"}
        </button>
        {model.location && <p className="text-sm text-muted-foreground">{model.location}</p>}
        {model.summary && <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{model.summary}</p>}
        {details}

        <button type="button" onClick={onGuestlist} className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-3 text-left">
          <div className="flex -space-x-2">
            {model.guestAvatars.slice(0, 4).map((src, index) => (
              <Avatar key={index} className="h-8 w-8 border border-background">
                <AvatarImage src={src || undefined} />
                <AvatarFallback>{model.guestNames[index]?.[0] || "?"}</AvatarFallback>
              </Avatar>
            ))}
            {model.guestAvatars.length === 0 && <Users className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{guestlistLine(model.guestNames, model.going)}</p>
            <p className="text-xs text-muted-foreground">{goingCountLabel(model.going)}</p>
          </div>
          <span className="text-sm text-primary">View</span>
        </button>

        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={model.hostAvatar || undefined} />
            <AvatarFallback>{model.hostName[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{model.hostName}</p>
            <p className="text-xs text-muted-foreground">{model.hostEvents} events · {model.hostAttendees} attendees</p>
          </div>
          <Button variant="outline" size="sm" onClick={onFollow}>{following ? "Following" : "Follow"}</Button>
        </div>

        <div className="grid gap-2">
          <RowButton icon={<Calendar className="h-4 w-4" />} label="Add to calendar" onClick={onCalendar} />
          <RowButton icon={<MessageCircle className="h-4 w-4" />} label="Contact organizer" onClick={onContact} />
          <RowButton icon={<Flag className="h-4 w-4" />} label="Report event" onClick={onReport} />
        </div>
        {reminder}
        <PoweredByEther />
      </div>

      {!model.past && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/50 bg-background/95 px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
          <Button className="h-12 w-full rounded-full text-base" style={ctaStyle} onClick={onCta} disabled={model.cta === "Sold out"}>
            {model.cta}
          </Button>
        </div>
      )}
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-10 w-10 items-center justify-center rounded-full bg-background/70 text-foreground backdrop-blur">
      {children}
    </button>
  );
}

function RowButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3 text-sm">
      {icon}
      {label}
    </button>
  );
}
