import { Link } from "react-router-dom";
import { QuestCard } from "@/components/novi/QuestCard";
import { useNoviQuests } from "@/hooks/useNoviQuests";
import { nextQuest } from "@/lib/noviQuests";

export function ProfileNovi() {
  const { quests } = useNoviQuests();
  const quest = nextQuest(quests);
  return quest ? (
    <QuestCard quest={quest} />
  ) : (
    <Link to="/quests" className="file-panel block min-h-11 px-4 py-4">
      <span className="mono-label text-[8px] text-[hsl(var(--brand))]">Novi</span>
      <span className="ether-title mt-1 block text-[16px]">Quest log</span>
    </Link>
  );
}
