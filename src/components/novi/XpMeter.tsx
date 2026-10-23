import { useReducedMotion, useXpReadout } from "@/hooks/useEasedNumber";
import { type XpReadout } from "@/lib/xpMotion";
import { XpBurst } from "@/components/novi/XpBurst";

interface XpMeterProps {
  total: number;
  burstToken?: number;
  /** Profile line. Level is appended from the XP currently on screen. */
  caption?: string;
  dense?: boolean;
  /** Shared count-up so a sibling level label cannot run ahead of this meter. */
  readout?: XpReadout;
}

function XpMeterView({
  view,
  burstToken = 0,
  caption,
  dense = false,
}: {
  view: XpReadout;
  burstToken?: number;
  caption?: string;
  dense?: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="mono-label text-[9px] text-[hsl(var(--brand))]">
          {caption ? `${caption} // Lv ${view.level}` : `${view.xp} XP`}
        </span>
        <span className="mono-label text-[9px] tabular-nums text-muted-foreground">
          {caption ? `${view.xp} XP` : `${view.into}/${view.span}`}
        </span>
      </div>
      <div className={`overflow-hidden rounded-full bg-foreground/10 ${dense ? "h-1.5" : "h-2"}`}>
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#FFD6E8,#FF9FC8)]"
          style={{ width: `${Math.max(0, Math.min(100, view.ratio * 100))}%` }}
        />
      </div>
      {!reduced && burstToken > 0 && <XpBurst key={burstToken} />}
    </div>
  );
}

function XpMeterCounting(props: Omit<XpMeterProps, "readout">) {
  const view = useXpReadout(props.total);
  return <XpMeterView {...props} view={view} />;
}

export function XpMeter({ readout, ...props }: XpMeterProps) {
  if (readout) return <XpMeterView {...props} view={readout} />;
  return <XpMeterCounting {...props} />;
}
