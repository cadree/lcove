import { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Scan } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { NoviCutout } from "@/components/novi/NoviPeek";
import { SquircleIcon } from "@/components/world/SquircleIcon";
import { useNoviQuests } from "@/hooks/useNoviQuests";
import { useEnergy } from "@/hooks/useEnergy";
import { useCredits } from "@/hooks/useCredits";
import { dailyDecodeCopy, type QuestView } from "@/lib/noviQuests";

const tabs = ["Active", "Daily", "Story", "Done"] as const;
type Tab = (typeof tabs)[number];

function visible(tab: Tab, quest: QuestView): boolean {
  if (tab === "Done") return quest.state === "decrypted";
  if (tab === "Story") return quest.lane === "story";
  if (tab === "Daily") return false;
  return quest.state !== "decrypted";
}

const QuestLog = () => {
  const { quests, total, bar, streak, dailyDone, dailyXp, complete } = useNoviQuests();
  const { energy, currentEnergy } = useEnergy();
  const { balance } = useCredits();
  const [tab, setTab] = useState<Tab>("Active");
  const rows = quests.filter((quest) => visible(tab, quest));
  const energyValue = energy ? currentEnergy : 0;

  return (
    <PageLayout>
      <div className="mx-auto max-w-md px-4 pb-28 pt-4">
        <p className="kicker">// Neo gold</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <h1 className="ether-title text-[34px]">Level {bar.level}</h1>
            <p className="lore text-[18px] text-foreground">Creator</p>
          </div>
          <NoviCutout className="h-28 w-24" />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="mono-label text-[9px] text-muted-foreground">{total} XP</span>
            <span className="mono-label text-[9px] text-muted-foreground">
              {bar.into}/{bar.span}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#FFD6E8,#FF9FC8)]" style={{ width: `${Math.round(bar.ratio * 100)}%` }} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Streak", String(streak)],
            ["Energy", String(energyValue)],
            ["Credits", String(balance)],
          ].map(([label, value]) => (
            <div key={label} className="file-panel px-3 py-3 text-center">
              <p className="font-body text-[19px] font-extrabold text-foreground">{value}</p>
              <p className="mono-label text-[8px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`mono-label inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-[11px] ${
                tab === item
                  ? "border-[hsl(var(--scan))] text-foreground shadow-[inset_0_0_12px_rgba(121,195,207,0.35)]"
                  : "border-border text-muted-foreground"
              }`}
              aria-pressed={tab === item}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {rows.map((quest) => (
            <Link key={quest.id} to={quest.href} className="file-panel flex items-center gap-3 px-3 py-3">
              <SquircleIcon icon={Lock} fill={quest.state === "decrypted" ? "green" : quest.state === "progress" ? "pink" : "ink"} size={32} glyph={15} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-body text-[15px] font-extrabold">{quest.title}</span>
                <span className="mono-label text-[8px] text-muted-foreground">
                  {quest.state === "decrypted" ? "Decrypted" : quest.state === "progress" ? "In progress" : "Sealed"} · {quest.progress}/{quest.target}
                </span>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-foreground/10">
                  <span className="block h-full bg-[linear-gradient(90deg,#FFD6E8,#FF9FC8)]" style={{ width: `${Math.round((quest.progress / quest.target) * 100)}%` }} />
                </span>
              </span>
            </Link>
          ))}
          {rows.length === 0 && tab !== "Daily" && (
            <p className="font-body text-sm text-muted-foreground">Nothing in this file.</p>
          )}
        </div>
        {(tab === "Daily" || tab === "Active") && (
          <button
            type="button"
            className="quest-card mt-4 w-full text-left"
            onClick={() => complete.mutate(`daily:${new Date().toISOString().slice(0, 10)}`)}
            disabled={dailyDone || complete.isPending}
          >
            <div className="flex items-center gap-3">
              <SquircleIcon icon={Scan} fill="cyan" size={52} glyph={28} />
              <span>
                <span className="mono-label block text-[8px] text-[hsl(var(--scan))]">Daily decode</span>
                <span className="font-body text-[15px] font-extrabold">Decode today&apos;s symbol</span>
                <span className="lore block text-[14px] text-muted-foreground">
                  {dailyDecodeCopy(dailyDone, dailyXp)}
                </span>
              </span>
            </div>
          </button>
        )}
      </div>
    </PageLayout>
  );
};

export default QuestLog;
