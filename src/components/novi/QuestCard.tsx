import { useState } from "react";
import { Link } from "react-router-dom";
import { NoviPeek } from "@/components/novi/NoviPeek";
import { NoviGuide } from "@/components/novi/NoviGuide";
import { XpBurst } from "@/components/novi/XpBurst";
import { useNoviQuests } from "@/hooks/useNoviQuests";
import { useReducedMotion } from "@/hooks/useEasedNumber";
import { useXpCelebrate } from "@/hooks/useXpCelebrate";
import { decryptedKey, type QuestView } from "@/lib/noviQuests";

export function QuestCard({ quest }: { quest: QuestView }) {
  const { total, quests, isReady } = useNoviQuests();
  const burst = useXpCelebrate(total, decryptedKey(quests), isReady);
  const reduced = useReducedMotion();
  const [guideOpen, setGuideOpen] = useState(false);
  const ratio = Math.round((quest.progress / quest.target) * 100);

  return (
    <div className="quest-card relative">
      {!reduced && burst > 0 && (
        <span className="pointer-events-none absolute right-16 top-8 z-[2]">
          <XpBurst key={burst} />
        </span>
      )}
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
          className="quest-fill h-full rounded-full bg-[linear-gradient(90deg,#FFD6E8,#FF9FC8)]"
          style={{ width: `${ratio}%` }}
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
      <NoviPeek onPress={() => setGuideOpen(true)} />
      <NoviGuide open={guideOpen} onOpenChange={setGuideOpen} burstToken={burst} />
    </div>
  );
}
