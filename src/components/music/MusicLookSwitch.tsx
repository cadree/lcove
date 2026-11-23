import { MUSIC_LOOKS, type MusicLook } from "@/lib/musicView";

/** The owner picks how their music page looks; visitors see that choice. */
export function MusicLookSwitch({ value, onChange }: { value: MusicLook; onChange: (look: MusicLook) => void }) {
  return (
    <div className="flex items-center justify-between gap-3" data-testid="music-look-switch">
      <span className="text-xs text-[var(--mv-muted)]">Page look</span>
      <div role="radiogroup" aria-label="Page look" className="flex rounded-full border border-[var(--mv-line)] p-1">
        {MUSIC_LOOKS.map((look) => (
          <button
            key={look.id}
            type="button"
            role="radio"
            aria-checked={value === look.id}
            onClick={() => onChange(look.id)}
            className={`min-h-9 rounded-full px-4 text-[13px] font-semibold ${value === look.id ? "bg-[var(--mv-accent)] text-[var(--mv-on-accent)]" : "text-[var(--mv-muted)]"}`}
          >
            {look.label}
          </button>
        ))}
      </div>
    </div>
  );
}
