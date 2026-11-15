/** Project wrap-up vouches: "showed up and delivered", with an optional note. */
export const VOUCH_NOTE_MAX = 280;
export const VOUCH_LINE = "Showed up and delivered";

export interface WrapUpMember {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  vouched: boolean;
  vouch_id: string | null;
}

export interface WrapUp {
  member: boolean;
  completed: boolean;
  team: WrapUpMember[];
}

export interface ProfileVouch {
  id: string;
  note: string | null;
  created_at: string;
  hidden: boolean;
  author_id: string;
  author_name: string | null;
  author_avatar: string | null;
  project_id: string | null;
  project_title: string | null;
}

export interface ProfileVouches {
  count: number;
  items: ProfileVouch[];
}

/** The note as it is saved: trimmed, blank means none. */
export function cleanVouchNote(note: string): string | null {
  const value = note.replace(/\s+/g, " ").trim();
  return value ? value : null;
}

export function vouchNoteError(note: string): string | null {
  const value = cleanVouchNote(note);
  return value && value.length > VOUCH_NOTE_MAX ? `Keep the note to ${VOUCH_NOTE_MAX} characters` : null;
}

export function vouchCountLabel(count: number): string {
  return count === 1 ? "1 vouch" : `${count} vouches`;
}

/** Teammates still waiting on my vouch come first, then by name. */
export function wrapUpOrder(team: WrapUpMember[]): WrapUpMember[] {
  return [...team].sort((a, b) => Number(a.vouched) - Number(b.vouched) || (a.name || "").localeCompare(b.name || ""));
}

/** "Vouched for 2 of 3 teammates" progress line, or null with nobody to vouch for. */
export function wrapUpProgress(team: WrapUpMember[]): string | null {
  if (!team.length) return null;
  const done = team.filter((m) => m.vouched).length;
  if (done === team.length) return team.length === 1 ? "You vouched for your teammate" : "You vouched for the whole team";
  return `You vouched for ${done} of ${team.length} ${team.length === 1 ? "teammate" : "teammates"}`;
}
