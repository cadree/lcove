import { ChevronDown } from "lucide-react";

/**
 * A small spinning globe with the deck's place under it. Tapping it opens the
 * city and state picker that narrows which cards show.
 */
export function GlobePlaceControl({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="deck-place"
      aria-label={`Choose a city or state for these cards. Showing ${label}`}
      className="group flex flex-col items-center gap-2"
    >
      <span className="relative block h-[66px] w-[66px] rounded-[22px] border-[3px] border-white/85 bg-[#1d1a22] p-1.5 shadow-[0_12px_30px_-10px_rgba(0,0,0,.8)] transition-transform group-active:scale-95">
        <span className="relative block h-full w-full overflow-hidden rounded-full bg-[radial-gradient(circle_at_35%_30%,#a9e1ec,#3d87a3_50%,#0f2738)]">
          <span
            aria-hidden="true"
            className="match-globe absolute inset-y-0 left-0 w-[200%] opacity-90"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 18% 22% at 20% 38%, #c9b48a 60%, transparent 62%), radial-gradient(ellipse 10% 16% at 30% 68%, #a7b77d 60%, transparent 62%), radial-gradient(ellipse 14% 12% at 70% 30%, #b9a57a 60%, transparent 62%), radial-gradient(ellipse 9% 20% at 80% 64%, #9cad73 60%, transparent 62%)",
              backgroundSize: "50% 100%",
              backgroundRepeat: "repeat-x",
            }}
          />
          <span aria-hidden="true" className="absolute inset-0 rounded-full shadow-[inset_-8px_-6px_14px_rgba(0,0,0,.55),inset_4px_4px_10px_rgba(255,255,255,.35)]" />
        </span>
        <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 rounded-full border-2 border-[#1d1a22] bg-[#ff9fc8]" />
      </span>
      <span className="inline-flex max-w-[220px] items-center gap-1 rounded-full bg-black/60 px-3.5 py-1.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,.8)] backdrop-blur">
        <span className="truncate">{label}</span>
        <ChevronDown size={14} aria-hidden="true" className="shrink-0 opacity-70" />
      </span>
    </button>
  );
}
