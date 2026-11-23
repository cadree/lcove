import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X, UserCheck, UserPlus } from "lucide-react";
import type { ConnectNudge, IcebreakerMe } from "@/lib/connectMoment";
import type { Person } from "@/lib/peopleDiscovery";
import { BEHIND, isSideways, pagerDots, stackPose, swipeTarget } from "@/lib/matchDeck";
import { safeWebLink } from "@/lib/tripMoney";
import { ProfileCard } from "./ProfileCard";

const REACTIONS = [
  { emoji: "❤️", className: "left-[16%] top-[6px] [animation-delay:-1.2s]" },
  { emoji: "🥰", className: "left-[6%] top-[58px] [animation-delay:-0.4s]" },
  { emoji: "🔥", className: "right-[15%] top-[2px] [animation-delay:-2s]" },
  { emoji: "✨", className: "right-[6%] top-[60px] [animation-delay:-2.8s]" },
];

/**
 * A stacked deck: the person in front as a large photo card, the next few fanned
 * behind it with their names showing. Drag sideways (or use the arrows) to browse;
 * Pass and Connect decide on the card in front. Only transforms animate, and the deck
 * never scrolls on its own, so it cannot fight the page scroll on iPhone.
 */
export function SwipeDeck({
  people,
  focus,
  pending,
  onDecide,
  onReport,
  onBlock,
  onReopen,
  nudgeFor,
  viewerId,
  me,
  top,
}: {
  people: Person[];
  /** Bring this person to the front, for example after tapping them in the avatar row. */
  focus: { id: string; at: number } | null;
  pending: boolean;
  onDecide: (person: Person, liked: boolean) => Promise<unknown>;
  onReport: (person: Person) => void;
  onBlock: (person: Person) => void;
  /** Already connected: open the start-something sheet instead of sending another swipe. */
  onReopen?: (person: Person) => void;
  nudgeFor?: (userId: string) => ConnectNudge | undefined;
  viewerId?: string;
  me?: IcebreakerMe | null;
  /** Sits above the stack, between the floating reactions (the place control on Explore). */
  top?: ReactNode;
}) {
  const [active, setActive] = useState(0);
  const [leaving, setLeaving] = useState<{ person: Person; dir: -1 | 1; at: number } | null>(null);
  const index = Math.min(active, Math.max(0, people.length - 1));
  const current = people[index];
  const front = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; on: boolean; id: number } | null>(null);

  const go = useCallback(
    (next: number) => {
      if (next === index || next < 0 || next >= people.length) return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduce && people[index]) setLeaving({ person: people[index], dir: next > index ? -1 : 1, at: Date.now() });
      setActive(next);
    },
    [index, people],
  );

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), 320);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    if (!focus) return;
    const at = people.findIndex((p) => p.user_id === focus.id);
    if (at >= 0) setActive(at);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new focus request moves the deck
  }, [focus]);

  useEffect(() => {
    if (active > 0 && active >= people.length) setActive(Math.max(0, people.length - 1));
  }, [active, people.length]);

  const setFrontTransform = (dx: number) => {
    const el = front.current;
    if (!el) return;
    el.style.transition = dx === 0 ? "" : "none";
    el.style.transform = dx === 0 ? "" : `translate3d(${dx}px, 0, 0) rotate(${dx / 24}deg)`;
  };

  const decide = async (liked: boolean) => {
    if (!current || pending) return;
    if (liked && current.liked) {
      onReopen?.(current);
      return;
    }
    await onDecide(current, liked);
    // Stay on a connect so the celebration and nudge stay in view. Pass still advances.
    if (!liked && index + 1 < people.length) go(index + 1);
  };

  if (!people.length) return null;
  const behind = people.slice(index + 1, index + 1 + BEHIND);
  const { dots } = pagerDots(index, people.length);

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="Swipe through profiles"
      data-testid="match-deck"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      <div className="relative mx-auto flex h-[116px] max-w-[380px] items-start justify-center" aria-hidden={!top}>
        {REACTIONS.map((r) => (
          <span key={r.emoji} aria-hidden="true" className={`match-float pointer-events-none absolute select-none text-[30px] drop-shadow-[0_6px_14px_rgba(0,0,0,.45)] ${r.className}`}>
            {r.emoji}
          </span>
        ))}
        <div className="relative z-10">{top}</div>
      </div>

      <div className="relative mx-auto h-[min(540px,64dvh)] w-full max-w-[380px] pl-5 pt-[96px]">
        <ol className="absolute left-0 top-1/2 flex -translate-y-1/2 flex-col gap-2" aria-label={`${index + 1} of ${people.length}`}>
          {dots.map((i) => (
            <li key={i} aria-hidden="true" className={`block h-1.5 w-1.5 rounded-full transition-[transform,opacity] duration-300 ${i === index ? "scale-125 bg-white opacity-100" : "bg-white opacity-35"}`} />
          ))}
        </ol>
        <div className="relative h-full">
          {behind
            .map((person, i) => ({ person, depth: i + 1 }))
            .reverse()
            .map(({ person, depth }) => {
              const pose = stackPose(depth);
              const photo = safeWebLink(person.avatar_url);
              return (
                <div
                  key={person.user_id}
                  aria-hidden="true"
                  className="match-card absolute inset-0 origin-top rounded-[30px] border border-white/15 bg-[#3a3340]/80 px-4 pt-2.5 shadow-[0_18px_50px_-24px_rgba(0,0,0,.9)] backdrop-blur-md"
                  style={pose}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-[15px] font-medium text-white/85">
                      {person.name}
                      {person.role && <span className="text-white/50"> · {person.role}</span>}
                    </p>
                    {photo ? (
                      <img src={photo} alt="" className="h-5 w-5 shrink-0 rounded-[6px] object-cover ring-1 ring-white/40" loading="lazy" />
                    ) : (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-white/15 text-[10px] text-white/70">{person.name.charAt(0)}</span>
                    )}
                  </div>
                </div>
              );
            })}

          {leaving && (
            <div
              key={`leaving-${leaving.person.user_id}-${leaving.at}`}
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 z-30 ${leaving.dir < 0 ? "match-leave-left" : "match-leave-right"}`}
            >
              <ProfileCard person={leaving.person} near={false} />
            </div>
          )}

          {current && (
            <div
              key={current.user_id}
              ref={front}
              className="match-card match-enter absolute inset-0 z-20 [touch-action:pan-y]"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${people.length}`}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button,a,input,select,textarea")) return;
                drag.current = { x: e.clientX, y: e.clientY, dx: 0, on: false, id: e.pointerId };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d || d.id !== e.pointerId) return;
                const dx = e.clientX - d.x;
                const dy = e.clientY - d.y;
                if (!d.on) {
                  if (!isSideways(dx, dy)) {
                    if (Math.abs(dy) > 12) drag.current = null;
                    return;
                  }
                  d.on = true;
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                }
                d.dx = dx;
                setFrontTransform(dx);
              }}
              onPointerUp={() => {
                const d = drag.current;
                drag.current = null;
                if (!d?.on) return;
                const next = swipeTarget(d.dx, index, people.length);
                setFrontTransform(0);
                if (next !== index) go(next);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setFrontTransform(0);
              }}
            >
              <ProfileCard person={current} near nudge={nudgeFor?.(current.user_id)} viewerId={viewerId} me={me} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-30"
          aria-label="Previous profile"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void decide(false)}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-white/5 text-white backdrop-blur transition-transform active:scale-95 disabled:opacity-40"
          aria-label={`Pass on ${current?.name}`}
        >
          <X size={28} />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void decide(true)}
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#ff9fc8] text-[#2c1320] shadow-[0_10px_30px_-8px_rgba(255,159,200,.7)] transition-transform active:scale-95 disabled:opacity-40"
          aria-label={current?.liked ? `Connected with ${current?.name}` : `Connect with ${current?.name}`}
        >
          {current?.liked ? <UserCheck size={30} /> : <UserPlus size={30} />}
        </button>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-30"
          aria-label="Next profile"
          disabled={index >= people.length - 1}
          onClick={() => go(index + 1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-white/60">
        {index + 1} of {people.length} · Swipe sideways to browse. Connect both ways to match and open a chat.
      </p>
      {current && (
        <div className="mt-1 flex justify-center gap-4 text-xs text-white/50">
          <button type="button" className="min-h-11" onClick={() => onReport(current)}>
            Report {current.name}
          </button>
          <button type="button" className="min-h-11" onClick={() => onBlock(current)}>
            Block
          </button>
        </div>
      )}
    </div>
  );
}
