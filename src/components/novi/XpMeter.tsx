import { xpBar } from "@/lib/noviQuests";
import { useEasedNumber, useReducedMotion } from "@/hooks/useEasedNumber";
import { XpBurst } from "@/components/novi/XpBurst";

interface XpMeterProps {
  total: number;
  burstToken?: number;
  /** Profile line. Level is appended from the animated total. */
  caption?: string;
  dense?: boolean;
}

export function XpMeter({ total, burstToken = 0, caption, dense = false }: XpMeterProps) {
  const reduced = useReducedMotion();
  const shown = useEasedNumber(total);
  const display = Math.round(shown);
  const bar = xpBar(display);

  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="mono-label text-[9px] text-[hsl(var(--brand))]">
          {caption ? `${caption} // Lv ${bar.level}` : `${display} XP`}
        </span>
        <span className="mono-label text-[9px] tabular-nums text-muted-foreground">
          {caption ? `${display} XP` : `${bar.into}/${bar.span}`}
        </span>
      </div>
      <div className={`overflow-hidden rounded-full bg-foreground/10 ${dense ? "h-1.5" : "h-2"}`}>
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#FFD6E8,#FF9FC8)]"
          style={{ width: `${Math.max(0, Math.min(100, bar.ratio * 100))}%` }}
        />
      </div>
      {!reduced && burstToken > 0 && <XpBurst key={burstToken} />}
    </div>
  );
}
