import { QuestCard } from "@/components/novi/QuestCard";
import { useNoviQuests } from "@/hooks/useNoviQuests";
import { nextQuest } from "@/lib/noviQuests";

export function ProfileNovi() {
  const { quests } = useNoviQuests();
  const quest = nextQuest(quests);
  if (!quest) return null;
  return <QuestCard quest={quest} />;
}
