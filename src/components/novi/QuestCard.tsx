import { Link } from "react-router-dom";
import { NoviPeek } from "@/components/novi/NoviPeek";
import type { QuestView } from "@/lib/noviQuests";

export function QuestCard({ quest }: { quest: QuestView }) {
  return (
    <div className="quest-card relative">
      <p className="mono-label text-[8px] text-[hsl(var(--brand))]">Novi // Quest</p>
      <div className="mt-1 flex items-start justify-between gap-3 pr-14">
        <div>
          <p className="font-body text-[15px] font-extrabold text-foreground">{quest.title}</p>
          <p className="lore text-[14px] text-muted-foreground">{quest.detail}</p>
        </div>
        {quest.xp > 0 && (
          <span className="mono-label shrink-0 rounded-full bg-[linear-gradient(180deg,#FFD6E8,#FF9FC8)] px-2 py-1 text-[9px] text-[#0A0A0A]">
            +{quest.xp} XP
          </span>
        )}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#FFD6E8,#FF9FC8)]"
          style={{ width: `${Math.round((quest.progress / quest.target) * 100)}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between pr-28">
        <Link to="/quests" className="mono-label inline-flex min-h-11 items-center text-[9px] text-muted-foreground">
          Later
        </Link>
        <Link to={quest.href} className="mono-label inline-flex min-h-11 items-center text-[9px] text-foreground">
          Follow quest →
        </Link>
      </div>
      <NoviPeek />
    </div>
  );
}
