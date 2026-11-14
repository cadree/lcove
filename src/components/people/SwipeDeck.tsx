import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, UserCheck, UserPlus } from "lucide-react";
import type { Person } from "@/lib/peopleDiscovery";
import { ProfileCard } from "./ProfileCard";

/**
 * Big profile cards in a horizontal swipe. Swiping (or the arrows) moves between
 * people; Pass and Connect decide on the card in front and move to the next one.
 */
export function SwipeDeck({
  people,
  focus,
  pending,
  onDecide,
  onReport,
  onBlock,
}: {
  people: Person[];
  /** Scroll to this person, for example after tapping them in the avatar row. */
  focus: { id: string; at: number } | null;
  pending: boolean;
  onDecide: (person: Person, liked: boolean) => Promise<unknown>;
  onReport: (person: Person) => void;
  onBlock: (person: Person) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const current = people[Math.min(active, people.length - 1)];

  /** Distance between two cards; card i snaps at i * step. */
  const step = () => {
    const cards = track.current?.children;
    if (!cards?.length) return 1;
    return cards.length > 1
      ? (cards[1] as HTMLElement).offsetLeft - (cards[0] as HTMLElement).offsetLeft
      : (cards[0] as HTMLElement).offsetWidth;
  };

  // While a programmatic scroll runs, scroll events report positions in between.
  const target = useRef<number | null>(null);
  const go = useCallback((index: number, jump = false) => {
    if (!track.current) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.current = index;
    track.current.scrollTo({ left: index * step(), behavior: jump || reduce ? "auto" : "smooth" });
    setActive(index);
  }, []);

  useEffect(() => {
    if (!focus) return;
    const index = people.findIndex((p) => p.user_id === focus.id);
    if (index >= 0) go(index, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new focus request moves the deck
  }, [focus, go]);

  useEffect(() => {
    if (active > 0 && active >= people.length) setActive(Math.max(0, people.length - 1));
  }, [active, people.length]);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const at = Math.max(0, Math.min(people.length - 1, Math.round(el.scrollLeft / step())));
    if (target.current !== null) {
      if (Math.abs(el.scrollLeft - target.current * step()) > 2) return;
      target.current = null;
    }
    setActive(at);
  };

  const decide = async (liked: boolean) => {
    if (!current || pending) return;
    await onDecide(current, liked);
    if (active + 1 < people.length) go(active + 1);
  };

  if (!people.length) return null;
  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="Swipe through profiles"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(Math.min(people.length - 1, active + 1));
        if (e.key === "ArrowLeft") go(Math.max(0, active - 1));
      }}
    >
      <div
        ref={track}
        onScroll={onScroll}
        onPointerDown={() => (target.current = null)}
        onWheel={() => (target.current = null)}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 scrollbar-hide"
        style={{ overscrollBehaviorX: "contain" }}
      >
        {people.map((person, index) => (
          <div
            key={person.user_id}
            className="h-[min(560px,68dvh)] w-[86%] max-w-[380px] shrink-0 snap-start sm:w-[340px] lg:w-[328px]"
            aria-hidden={index !== active}
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${people.length}`}
          >
            <ProfileCard person={person} near={Math.abs(index - active) <= 1} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4">
        <button
          type="button"
          className="hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-30 sm:flex"
          aria-label="Previous profile"
          disabled={active === 0}
          onClick={() => go(active - 1)}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void decide(false)}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-white/5 text-white transition active:scale-95 disabled:opacity-40"
          aria-label={`Pass on ${current?.name}`}
        >
          <X size={28} />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void decide(true)}
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#ff9fc8] text-[#2c1320] shadow-[0_10px_30px_-8px_rgba(255,159,200,.7)] transition active:scale-95 disabled:opacity-40"
          aria-label={current?.liked ? `Connected with ${current?.name}` : `Connect with ${current?.name}`}
        >
          {current?.liked ? <UserCheck size={30} /> : <UserPlus size={30} />}
        </button>
        <button
          type="button"
          className="hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-30 sm:flex"
          aria-label="Next profile"
          disabled={active >= people.length - 1}
          onClick={() => go(active + 1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-white/60">
        {active + 1} of {people.length} · Swipe to browse. Connect both ways to match and open a chat.
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
