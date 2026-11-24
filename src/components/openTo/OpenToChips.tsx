import { Sparkles } from "lucide-react";
import { OPEN_TO, openToLabel, type OpenToTag } from "@/lib/openTo";

/** Small "Open to" pills. `tone="photo"` sits on a profile card photo. */
export function OpenToChips({
  tags, until, tone = "plain", limit, className = "",
}: {
  tags: readonly string[];
  until?: string | null;
  tone?: "plain" | "photo";
  limit?: number;
  className?: string;
}) {
  const known = tags.filter((t) => openToLabel(t));
  if (!known.length) return null;
  const shown = limit ? known.slice(0, limit) : known;
  const more = known.length - shown.length;
  const pill = tone === "photo"
    ? "border-white/25 bg-black/35 text-white backdrop-blur"
    : "border-border bg-muted/60 text-foreground";
  return (
    <span role="group" className={`flex flex-wrap items-center gap-1.5 ${className}`} data-testid="open-to-chips" aria-label={`Open to ${known.map((t) => openToLabel(t)).join(", ")}`}>
      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${tone === "photo" ? "text-white/80" : "text-muted-foreground"}`}>
        <Sparkles className="h-3 w-3" aria-hidden /> Open to
      </span>
      {shown.map((tag) => (
        <span key={tag} className={`rounded-full border px-2.5 py-0.5 text-[11px] ${pill}`}>{openToLabel(tag)}</span>
      ))}
      {more > 0 && <span className={`text-[11px] ${tone === "photo" ? "text-white/70" : "text-muted-foreground"}`}>+{more}</span>}
      {until && <span className={`text-[11px] ${tone === "photo" ? "text-white/70" : "text-muted-foreground"}`}>· {until}</span>}
    </span>
  );
}

/** Explore filter: show only people open to every picked tag. */
export function OpenToFilter({ value, onChange }: { value: OpenToTag[]; onChange: (next: OpenToTag[]) => void }) {
  const toggle = (tag: OpenToTag) =>
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : OPEN_TO.map((t) => t.id).filter((t) => t === tag || value.includes(t)));
  return (
    <div className="-mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide" role="group" aria-label="Filter by open to" data-testid="open-to-filter" style={{ overscrollBehaviorX: "contain" }}>
      <span className="shrink-0 text-xs text-white/60">Open to</span>
      {OPEN_TO.map((tag) => {
        const on = value.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(tag.id)}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-xs transition ${on ? "border-[#ff9fc8] bg-[#ff9fc8] text-[#2c1320]" : "border-white/15 bg-white/5 text-white/80"}`}
          >
            {tag.label}
          </button>
        );
      })}
      {!!value.length && (
        <button type="button" className="min-h-9 shrink-0 px-2 text-xs text-white/60 underline" onClick={() => onChange([])}>
          Clear
        </button>
      )}
    </div>
  );
}
