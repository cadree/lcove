// Rules for project discovery, subgroup access, and chat alerts.
// The SQL policies in 20261019194500_project_collaborations.sql enforce the
// same access decisions. These functions are what the app and the tests share.

export type ListingType = "project" | "gig";

export const CHAT_EMAIL_WINDOW_MS = 15 * 60 * 1000;

export function communityNotificationEnabled(
  preference: boolean | null | undefined,
): boolean {
  return preference !== false;
}

export function shouldNotifyCommunity(input: {
  isPrivate: boolean;
  isCreator: boolean;
  categoryEnabled: boolean | null | undefined;
}): boolean {
  if (input.isPrivate || input.isCreator) return false;
  return communityNotificationEnabled(input.categoryEnabled);
}

export function canViewProject(input: {
  isPrivate: boolean;
  status: string;
  isCreator: boolean;
  isAcceptedMember: boolean;
  isInvited: boolean;
}): boolean {
  if (input.isCreator || input.isAcceptedMember || input.isInvited) return true;
  if (input.isPrivate) return false;
  return input.status === "open" || input.status === "in_progress" || input.status === "completed";
}

/** Owner can read every project chat, including subgroups they were not added to. */
export function canReadProjectConversation(input: {
  isParticipant: boolean;
  isProjectOwner: boolean;
}): boolean {
  return input.isParticipant || input.isProjectOwner;
}

/** Posting stays limited to people who were added to that chat. */
export function canSendProjectConversation(input: { isParticipant: boolean }): boolean {
  return input.isParticipant;
}

export function chatAlertChannels(input: {
  isSender: boolean;
  isMuted: boolean;
  messagesEnabled: boolean | null | undefined;
  pushEnabled: boolean | null | undefined;
  emailEnabled: boolean | null | undefined;
}): { inApp: boolean; push: boolean; email: boolean } {
  if (input.isSender || input.messagesEnabled === false) {
    return { inApp: false, push: false, email: false };
  }
  if (input.isMuted) return { inApp: true, push: false, email: false };
  return {
    inApp: true,
    push: input.pushEnabled !== false,
    email: input.emailEnabled !== false,
  };
}

export function shouldEnqueueChatEmail(input: {
  nowMs: number;
  lastEnqueuedAtMs: number | null;
  windowMs?: number;
}): boolean {
  const windowMs = input.windowMs ?? CHAT_EMAIL_WINDOW_MS;
  if (input.lastEnqueuedAtMs == null) return true;
  return input.nowMs - input.lastEnqueuedAtMs >= windowMs;
}

export function formatRoleCompensation(payout: number, credit: number): string {
  const parts: string[] = [];
  if (payout > 0) {
    parts.push(
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(payout),
    );
  }
  if (credit > 0) parts.push(`${credit.toLocaleString("en-US")} XP`);
  return parts.length > 0 ? parts.join(" + ") : "Open role";
}

export function calendarInclusion(input: {
  isPrivate: boolean;
  hideFromCalendar: boolean;
  status: string;
  timelineStart: string | null;
  createdAt: string;
}): { visible: boolean; start: string | null } {
  const visible =
    !input.isPrivate &&
    !input.hideFromCalendar &&
    (input.status === "open" || input.status === "in_progress" || input.status === "completed");
  if (!visible) return { visible: false, start: null };
  return { visible: true, start: input.timelineStart || input.createdAt };
}

export interface MilestoneDraft {
  title: string;
  phase?: string;
  due_date?: string | null;
}

/** Drop untitled milestone rows. A blank date is null, not "", so the date column accepts the insert. */
export function milestonesForInsert(rows: MilestoneDraft[]): {
  title: string;
  phase: string | null;
  due_date: string | null;
}[] {
  return rows.flatMap((row) => {
    const title = row.title.trim();
    if (!title) return [];
    const due = row.due_date?.trim() ?? "";
    const phase = row.phase?.trim() ?? "";
    return [{
      title,
      phase: phase || null,
      due_date: due || null,
    }];
  });
}

/** XP is only the amount the owner typed on that role. A pay-only role stays at 0. */
export function roleCreditAmount(credit: number | null | undefined): number {
  const value = Number(credit);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

export function youtubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/,
  );
  return match?.[1] ?? null;
}
