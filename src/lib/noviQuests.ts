export const QUEST_IDS = ["enter_signal", "first_post", "find_people", "read_book", "finish_project", "open_studio"] as const;
export type QuestId = (typeof QUEST_IDS)[number];
export type QuestState = "sealed" | "progress" | "decrypted";
export type QuestLane = "story" | "work";

export interface QuestSignals {
  profileReady: boolean;
  postCount: number;
  connectionCount: number;
  bookOpened: boolean;
  completedProjects: number;
  studioOpened?: boolean;
}

export interface QuestView {
  id: QuestId;
  title: string;
  detail: string;
  lane: QuestLane;
  href: string;
  /** XP this quest writes itself. Zero when another trigger already paid. */
  xp: number;
  progress: number;
  target: number;
  state: QuestState;
}

const LEVEL_BANDS = [0, 40, 100, 200, 400];

export function xpLevel(total: number): number {
  if (total >= 400) return 5;
  if (total >= 200) return 4;
  if (total >= 100) return 3;
  if (total >= 40) return 2;
  return 1;
}

/** Fill of the bar inside the current level. The next band is the target. */
export function xpBar(total: number): { level: number; into: number; span: number; ratio: number } {
  const level = xpLevel(total);
  const start = LEVEL_BANDS[level - 1] ?? 0;
  const end = LEVEL_BANDS[level] ?? start + 400;
  const span = Math.max(1, end - start);
  const into = Math.max(0, Math.min(span, total - start));
  return { level, into, span, ratio: into / span };
}

export function streakFromDays(days: string[], today: string): number {
  const have = new Set(days);
  const cursor = new Date(`${today}T00:00:00Z`);
  if (!have.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let count = 0;
  while (have.has(cursor.toISOString().slice(0, 10))) {
    count += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return count;
}

function stateFor(progress: number, target: number): QuestState {
  if (progress >= target) return "decrypted";
  if (progress > 0) return "progress";
  return "sealed";
}

export function questViews(signals: QuestSignals): QuestView[] {
  const rows: Array<Omit<QuestView, "state"> & { progress: number; target: number }> = [
    {
      id: "enter_signal",
      title: "Enter the signal",
      detail: "Finish your profile so the archive can file you.",
      lane: "story",
      href: "/onboarding",
      xp: 10,
      progress: signals.profileReady ? 1 : 0,
      target: 1,
    },
    {
      id: "first_post",
      title: "Send your first signal",
      detail: "A post already writes 10 XP. This row only tracks it.",
      lane: "story",
      href: "/feed",
      xp: 0,
      progress: Math.min(1, signals.postCount),
      target: 1,
    },
    {
      id: "find_people",
      title: "Find your people",
      detail: "Add someone from the directory.",
      lane: "story",
      href: "/directory",
      xp: 10,
      progress: Math.min(1, signals.connectionCount),
      target: 1,
    },
    {
      id: "read_book",
      title: "Read CX-01",
      detail: "Open the Book of LCOVE.",
      lane: "story",
      href: "/book",
      xp: 10,
      progress: signals.bookOpened ? 1 : 0,
      target: 1,
    },
    {
      id: "finish_project",
      title: "Finish a project",
      detail: "Completing a project already writes 25 XP.",
      lane: "work",
      href: "/projects",
      xp: 0,
      progress: Math.min(1, signals.completedProjects),
      target: 1,
    },
    {
      id: "open_studio",
      title: "Open Studio",
      detail: "Open the Studio sheet from your profile or the feed.",
      lane: "work",
      href: "/feed?studio=1",
      xp: 10,
      progress: signals.studioOpened ? 1 : 0,
      target: 1,
    },
  ];
  return rows.map((row) => ({ ...row, state: stateFor(row.progress, row.target) }));
}

export function nextQuest(quests: QuestView[]): QuestView | null {
  return quests.find((quest) => quest.id !== "open_studio" && quest.state !== "decrypted") ?? null;
}

/** Studio stays visible beside the current quest until it is filed. */
export function studioQuest(quests: QuestView[]): QuestView | null {
  const quest = quests.find((row) => row.id === "open_studio");
  if (!quest || quest.state === "decrypted") return null;
  return quest;
}

/** Copy for the daily decode tile. granted is the XP row that was written. */
export function dailyDecodeCopy(done: boolean, granted: number): string {
  if (!done) return "One tap files today. The ledger writes up to 5 XP.";
  if (granted <= 0) return "Decoded. The daily cap granted 0 XP.";
  return `Decoded. ${granted} XP is on the ledger.`;
}

export function fileCode(id: string): string {
  const compact = id.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase();
  return `FILE ${compact.padEnd(4, "0")}`;
}
