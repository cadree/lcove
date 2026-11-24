import { type ReactNode } from "react";
import { XpMeter } from "@/components/novi/XpMeter";
import { readoutAt } from "@/lib/xpMotion";

/**
 * Quest level block. Every level label and the XP number come from one
 * readoutAt(displayedXp) call. This component does not run its own count-up.
 */
export function QuestHero({
  displayedXp,
  burstToken = 0,
  cutout,
}: {
  displayedXp: number;
  burstToken?: number;
  cutout?: ReactNode;
}) {
  const view = readoutAt(displayedXp);

  return (
    <>
      <div className="relative mt-3 overflow-hidden rounded-[18px] border border-[color-mix(in_srgb,#FF9FC8_55%,transparent)] bg-[radial-gradient(circle_at_70%_18%,rgba(255,159,200,0.34),transparent_58%)] px-4 pb-4 pt-3">
        <p className="mono-label text-[8px] text-[hsl(var(--brand))]">Novi // Hero</p>
        {cutout}
        <h1 className="ether-title text-center text-[40px]">Level {view.level}</h1>
        <p className="lore text-center text-[18px] text-foreground">Creator</p>
      </div>
      <div className="mt-3">
        <XpMeter total={view.xp} burstToken={burstToken} readout={view} />
      </div>
    </>
  );
}
