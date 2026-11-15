import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Calendar, FolderKanban, MessageCircle, Plane, X } from "lucide-react";
import { MessageRequestDialog } from "@/components/messages/MessageRequestDialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { pulseConnectHaptic } from "@/lib/xpHaptic";
import {
  addNudge,
  celebrationEyebrow,
  celebrationHeadline,
  CONNECT_NUDGE_EVENT,
  dismissNudge,
  firstName,
  icebreaker,
  markNudgeStarted,
  messageHref,
  nudgeCopy,
  nudgeFor,
  readNudges,
  travelHref,
  type ConnectNudge,
  type IcebreakerMe,
} from "@/lib/connectMoment";
import { safeWebLink } from "@/lib/tripMoney";
import { createHref, type InviteKind } from "@/lib/itemInvite";
import { InvitePicker } from "@/components/people/InvitePicker";
import type { Person } from "@/lib/peopleDiscovery";
import { cn } from "@/lib/utils";

const CELEBRATE_MS = 2000;
const IMPACT_MS = 420;

export interface ConnectViewer {
  name: string;
  avatarUrl: string | null;
}

export interface ConnectMomentEvent {
  person: Person;
  matched: boolean;
  conversationId: string | null;
}

export function nudgeFromPerson(person: Person, matched: boolean, conversationId: string | null): ConnectNudge {
  return {
    userId: person.user_id,
    name: person.name,
    avatarUrl: person.avatar_url,
    role: person.role,
    skills: person.skills,
    passions: person.passions,
    city: person.live?.label || person.home?.label || person.city_display || person.city,
    tripCity: person.trip?.city_label || null,
    matched,
    conversationId,
    started: false,
    at: Date.now(),
  };
}

export function useConnectNudges(viewerId: string | undefined): ConnectNudge[] {
  const [nudges, setNudges] = useState(() => readNudges(window.localStorage, viewerId));
  useEffect(() => {
    const sync = () => setNudges(readNudges(window.localStorage, viewerId));
    sync();
    window.addEventListener(CONNECT_NUDGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CONNECT_NUDGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [viewerId]);
  return nudges;
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Two profile pictures bump, with confetti at impact, then a CTA sheet. Tap skips the burst. */
export function ConnectMomentHost({
  viewerId,
  viewer,
  me,
  event,
  onClear,
}: {
  viewerId: string | undefined;
  viewer?: ConnectViewer | null;
  me?: IcebreakerMe | null;
  event: ConnectMomentEvent | null;
  onClear: () => void;
}) {
  const [phase, setPhase] = useState<"off" | "celebrate" | "cta">("off");
  const [current, setCurrent] = useState<ConnectNudge | null>(null);

  useEffect(() => {
    if (!event) return;
    const nudge = nudgeFromPerson(event.person, event.matched, event.conversationId);
    addNudge(window.localStorage, viewerId, nudge);
    setCurrent(nudge);
    setPhase("celebrate");
    const motionOff = reducedMotion();
    const hapticAt = motionOff ? 0 : IMPACT_MS;
    const wait = motionOff ? 0 : CELEBRATE_MS;
    const buzz = window.setTimeout(() => pulseConnectHaptic(event.matched ? "match" : "connect"), hapticAt);
    const timer = window.setTimeout(() => setPhase("cta"), wait);
    return () => {
      window.clearTimeout(buzz);
      window.clearTimeout(timer);
    };
  }, [event, viewerId]);

  const skip = () => setPhase("cta");
  const close = () => {
    setPhase("off");
    setCurrent(null);
    onClear();
  };

  if (phase === "off" || !current) return null;
  return (
    <>
      {phase === "celebrate" && <ConnectCelebration nudge={current} viewer={viewer} onDismiss={skip} />}
      <ConnectCtaSheet
        open={phase === "cta"}
        nudge={current}
        me={me}
        viewerId={viewerId}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      />
    </>
  );
}

const MATCH_BITS = [
  { x: -72, y: -110, color: "#FF9FC8", delay: "0ms", round: true },
  { x: 78, y: -102, color: "#79C3CF", delay: "40ms", round: false },
  { x: -108, y: -36, color: "#FFD6E8", delay: "80ms", round: true },
  { x: 112, y: -28, color: "#E0B07A", delay: "20ms", round: true },
  { x: -24, y: -128, color: "#FF9FC8", delay: "60ms", round: false },
  { x: 30, y: -120, color: "#79C3CF", delay: "10ms", round: true },
  { x: -118, y: 40, color: "#FFD6E8", delay: "90ms", round: true },
  { x: 122, y: 36, color: "#E0B07A", delay: "30ms", round: false },
  { x: -86, y: 86, color: "#FF9FC8", delay: "50ms", round: true },
  { x: 90, y: 92, color: "#79C3CF", delay: "70ms", round: false },
] as const;

function ConnectBurst({ matched }: { matched: boolean }) {
  if (reducedMotion()) return null;
  const bits = matched ? MATCH_BITS : MATCH_BITS.slice(0, 6);
  return (
    <span className="connect-burst" aria-hidden="true">
      {bits.map((bit, index) => (
          <i
            key={index}
            style={{
              background: bit.color,
              animationDelay: `${IMPACT_MS + Number.parseInt(bit.delay, 10)}ms`,
              borderRadius: bit.round ? "999px" : "2px",
              ["--dx" as string]: `${bit.x}px`,
              ["--dy" as string]: `${bit.y}px`,
            }}
          />
        ))}
    </span>
  );
}

function ConnectFace({ name, url, side }: { name: string; url: string | null; side: "left" | "right" }) {
  const photo = safeWebLink(url);
  const letter = (firstName(name).charAt(0) || "?").toUpperCase();
  return (
    <span className={cn("connect-pair-face", side === "left" ? "is-left" : "is-right")} aria-hidden="true">
      {photo ? (
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-display text-[40px] leading-none text-[#faf5f0]">{letter}</span>
      )}
    </span>
  );
}

function ConnectCelebration({
  nudge,
  viewer,
  onDismiss,
}: {
  nudge: ConnectNudge;
  viewer?: ConnectViewer | null;
  onDismiss: () => void;
}) {
  const you = viewer?.name?.trim() ? viewer : { name: "You", avatarUrl: null };
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={nudge.matched ? `It's a match with ${nudge.name}` : `Connected with ${nudge.name}`}
      className="fixed inset-0 z-[200] flex cursor-pointer flex-col items-center justify-center bg-[rgba(8,8,10,0.92)] px-6 text-center backdrop-blur-sm"
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter" || e.key === " ") onDismiss();
      }}
      tabIndex={0}
      autoFocus
    >
      <div className={cn("connect-pair", !nudge.matched && "is-soft")} data-testid="connect-pair">
        <span className="connect-pair-glow" aria-hidden="true" />
        <ConnectFace name={you.name} url={you.avatarUrl} side="left" />
        <ConnectFace name={nudge.name} url={nudge.avatarUrl} side="right" />
        <ConnectBurst matched={nudge.matched} />
      </div>
      <p className="mono-label mt-5 text-[10px] tracking-[.25em] text-[#ff9fc8]">{celebrationEyebrow(nudge.matched)}</p>
      <h2 className={cn("mt-2 font-display leading-tight text-[#faf5f0]", nudge.matched ? "text-[36px]" : "text-[28px]")}>
        {celebrationHeadline(nudge)}
      </h2>
      <p className="mt-2 max-w-xs text-sm text-white/70">
        {nudge.matched ? "Your chat is ready. Pick something to start together." : "They only find out if they connect back. You can still send a note or start a plan."}
      </p>
      <p className="mt-6 text-xs text-white/45">Tap to continue</p>
    </div>,
    document.body,
  );
}

export function ConnectCtaSheet({
  open,
  nudge,
  me,
  viewerId,
  onOpenChange,
}: {
  open: boolean;
  nudge: ConnectNudge;
  me?: IcebreakerMe | null;
  viewerId: string | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [messaging, setMessaging] = useState(false);
  const [picking, setPicking] = useState<InviteKind | null>(null);
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    if (!open) setPicking(null);
  }, [open]);
  // Dismissing the nudge unmounts the line that owns this sheet, so an invite
  // only counts as "started" once the sheet closes.
  const changeOpen = (next: boolean) => {
    if (!next && invited) {
      setInvited(false);
      markNudgeStarted(window.localStorage, viewerId, nudge.userId);
    }
    onOpenChange(next);
  };
  const suggestion = useMemo(() => icebreaker({
    name: nudge.name,
    skills: nudge.skills,
    passions: nudge.passions,
    role: nudge.role,
    city: nudge.city,
    tripCity: nudge.tripCity,
  }, me), [nudge, me]);

  const started = () => {
    markNudgeStarted(window.localStorage, viewerId, nudge.userId);
    onOpenChange(false);
  };

  const canDm = nudge.matched && !!nudge.conversationId;
  const photo = safeWebLink(nudge.avatarUrl);

  return (
    <>
      <Sheet open={open} onOpenChange={changeOpen}>
        {open && (
          <SheetContent
            hideClose
            side="bottom"
            className="max-h-[85vh] border-border bg-[#1d1a22] px-4 pb-8 text-[#faf5f0]"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto mb-3 mt-1 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
            {picking ? (
              <>
                <SheetTitle className="sr-only">{`Invite ${nudge.name}`}</SheetTitle>
                <SheetDescription className="sr-only">Pick a project, gig or event to invite them to.</SheetDescription>
                <InvitePicker
                  kind={picking}
                  invitee={{ userId: nudge.userId, firstName: firstName(nudge.name) }}
                  onBack={() => setPicking(null)}
                  onSent={() => setInvited(true)}
                  onCreate={() => {
                    started();
                    navigate(createHref(picking));
                  }}
                />
              </>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#4a4150] ring-2 ring-[#ff9fc8]/70">
                      {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <span className="font-display text-xl">{firstName(nudge.name).charAt(0)}</span>}
                    </span>
                    <div className="min-w-0">
                      <p className="mono-label text-[8px] text-[#ff9fc8]">{celebrationEyebrow(nudge.matched)}</p>
                      <SheetTitle className="ether-title truncate text-left text-[26px] text-[#faf5f0]">{nudge.name}</SheetTitle>
                      <SheetDescription className="text-left text-sm text-white/65">
                        What do you want to start together?
                      </SheetDescription>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => changeOpen(false)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-white/60"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid gap-2">
                  <CtaButton
                    icon={<MessageCircle size={18} />}
                    label={canDm ? `Message ${firstName(nudge.name)}` : `Send ${firstName(nudge.name)} a note`}
                    hint={canDm ? "Opens your chat." : "A match unlocks a direct chat. This waits in their Requests."}
                    onClick={() => {
                      if (canDm && nudge.conversationId) {
                        started();
                        navigate(messageHref(nudge.conversationId));
                        return;
                      }
                      setMessaging(true);
                    }}
                  />
                  <CtaButton
                    icon={<FolderKanban size={18} />}
                    label="Invite to a project or gig"
                    hint="Pick one of yours, or an open one near you."
                    onClick={() => setPicking("project")}
                  />
                  <CtaButton
                    icon={<Plane size={18} />}
                    label="Plan a trip together"
                    hint="Opens trip planning."
                    onClick={() => {
                      started();
                      navigate(travelHref(nudge));
                    }}
                  />
                  <CtaButton
                    icon={<Calendar size={18} />}
                    label="Invite to an event"
                    hint="Pick an upcoming event of yours, or one near you."
                    onClick={() => setPicking("event")}
                  />
                </div>
              </>
            )}
          </SheetContent>
        )}
      </Sheet>
      {messaging && (
        <MessageRequestDialog
          person={{ user_id: nudge.userId, name: nudge.name }}
          open={messaging}
          initialBody={suggestion}
          onOpenChange={(next) => {
            setMessaging(next);
            if (!next) started();
          }}
        />
      )}
    </>
  );
}

function CtaButton({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/10 px-3 py-3 text-left ring-1 ring-white/10 transition hover:bg-white/15"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff9fc8] text-[#2c1320]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#faf5f0]">{label}</span>
        <span className="block text-xs text-white/55">{hint}</span>
      </span>
    </button>
  );
}

export function ConnectNudgeLine({
  nudge,
  viewerId,
  me,
  className,
}: {
  nudge: ConnectNudge;
  viewerId: string | undefined;
  me?: IcebreakerMe | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={cn("flex items-center gap-2 rounded-2xl bg-[#ff9fc8]/15 px-3 py-2 text-[13px] text-[#ffd6e8]", className)}>
        <p className="min-w-0 flex-1">{nudgeCopy(nudge)}</p>
        <button type="button" className="min-h-11 shrink-0 font-semibold text-[#ff9fc8] underline" onClick={() => setOpen(true)}>
          Start
        </button>
        <button
          type="button"
          className="inline-flex h-11 w-8 shrink-0 items-center justify-center text-white/45"
          aria-label="Dismiss nudge"
          onClick={() => dismissNudge(window.localStorage, viewerId, nudge.userId)}
        >
          <X size={14} />
        </button>
      </div>
      <ConnectCtaSheet open={open} nudge={nudge} me={me} viewerId={viewerId} onOpenChange={setOpen} />
    </>
  );
}

export function personNudge(nudges: ConnectNudge[], personId: string): ConnectNudge | undefined {
  return nudgeFor(nudges, personId);
}
