import { ChevronDown } from "lucide-react";

/** A miniature globe drawn as a lit sphere with a hairline graticule. */
function MiniGlobe() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" className="block shrink-0">
      <defs>
        <radialGradient id="mini-globe-fill" cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#5b5670" />
          <stop offset="55%" stopColor="#2a2633" />
          <stop offset="100%" stopColor="#141218" />
        </radialGradient>
        <linearGradient id="mini-globe-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ff9fc8" stopOpacity="0.55" />
        </linearGradient>
        <clipPath id="mini-globe-clip">
          <circle cx="16" cy="16" r="13" />
        </clipPath>
      </defs>
      <circle cx="16" cy="16" r="13" fill="url(#mini-globe-fill)" />
      <g clipPath="url(#mini-globe-clip)" fill="none" stroke="#ffffff" strokeOpacity="0.34" strokeWidth="0.6">
        <g>
          <ellipse cx="16" cy="16" rx="4.5" ry="13" />
          <ellipse cx="16" cy="16" rx="9.5" ry="13" />
          <line x1="16" y1="3" x2="16" y2="29" />
        </g>
        <line x1="3" y1="16" x2="29" y2="16" />
        <path d="M4.6 10h22.8M4.6 22h22.8" />
      </g>
      <circle cx="16" cy="16" r="13" fill="none" stroke="url(#mini-globe-rim)" strokeWidth="0.9" />
      <circle cx="21" cy="11.5" r="1.6" fill="#ff9fc8" />
    </svg>
  );
}

/**
 * One glass pill above the deck: the miniature globe takes you to the big globe,
 * the place name opens the city and state picker.
 */
export function GlobePlaceControl({ label, onOpen, onGlobe }: { label: string; onOpen: () => void; onGlobe?: () => void }) {
  return (
    <span
      data-testid="deck-place"
      className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.07] p-1 text-white shadow-[0_10px_28px_-14px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-xl"
    >
      {onGlobe && (
        <button
          type="button"
          onClick={onGlobe}
          aria-label="Show the globe"
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10 active:bg-white/15"
        >
          <MiniGlobe />
        </button>
      )}
      {onGlobe && <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-white/15" />}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Choose a city or state for these cards. Showing ${label}`}
        className="inline-flex h-9 max-w-[210px] items-center gap-1.5 rounded-full pl-2.5 pr-3 text-[13px] font-medium tracking-[0.01em] transition-colors hover:bg-white/10 active:bg-white/15"
      >
        {!onGlobe && <MiniGlobe />}
        <span className="truncate">{label}</span>
        <ChevronDown size={13} aria-hidden="true" className="shrink-0 opacity-60" />
      </button>
    </span>
  );
}
