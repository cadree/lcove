import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNoviQuests } from "@/hooks/useNoviQuests";
import { nextQuest, studioQuest, type QuestView } from "@/lib/noviQuests";

function QuestLine({ quest }: { quest: QuestView }) {
  return (
    <div className="rounded-[14px] border border-border px-3 py-3">
      <p className="font-body text-[15px] font-extrabold text-foreground">{quest.title}</p>
      <p className="lore text-[14px] text-muted-foreground">{quest.detail}</p>
      <p className="mono-label mt-2 text-[9px] text-muted-foreground">
        {quest.progress}/{quest.target}
        {quest.xp > 0 ? ` · +${quest.xp} XP when filed` : ""}
      </p>
      <Link to={quest.href} className="mono-label mt-2 inline-flex min-h-11 items-center text-[10px] text-foreground">
        Do this next →
      </Link>
    </div>
  );
}

export function NoviGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { quests, total } = useNoviQuests();
  const current = nextQuest(quests);
  const studio = studioQuest(quests);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="ether-title text-left text-[28px]">Novi</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {total} XP on the ledger. Levels unlock at 40, 100, 200, and 400.
        </p>
        <div className="space-y-3">
          {current ? <QuestLine quest={current} /> : <p className="text-sm text-muted-foreground">Every story quest is filed.</p>}
          {studio && <QuestLine quest={studio} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
