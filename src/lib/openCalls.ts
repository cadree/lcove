import { resolveCity } from "./cities.ts";
import { addDays, utcDay } from "./openTo.ts";

/** An open call as it shows on its project (RLS: anyone who can see the project). */
export interface OpenCall {
  id: string;
  project_id: string;
  role_id: string;
  created_by: string;
  city_key: string;
  city_label: string;
  call_date: string;
  paid: boolean;
  description: string | null;
  status: "open" | "closed";
  created_at: string;
}

/** A call in Explore, from open_calls_near. Never carries a venue or address. */
export interface NearbyCall {
  id: string;
  project_id: string;
  role_id: string;
  role: string;
  project_title: string;
  cover: string | null;
  listing_type: string | null;
  city_label: string;
  call_date: string;
  paid: boolean;
  description: string | null;
  owner_id: string;
  owner_name: string | null;
  owner_avatar: string | null;
  applied: boolean;
}

export interface CallRole {
  id: string;
  role_name: string;
  slots_available: number;
  slots_filled: number;
  is_locked: boolean;
}

export const CALL_NOTE_MAX = 280;
export const CALL_MAX_DAYS = 365;
const CITY_KEY = /^[a-z0-9][^|]{0,79}(\|[a-z]{2})?$/;

export function roleOpen(role: Pick<CallRole, "slots_available" | "slots_filled" | "is_locked"> | undefined): boolean {
  return !!role && !role.is_locked && role.slots_filled < role.slots_available;
}

/** Why a call no longer takes people, or null while it does. */
export function callEnded(call: Pick<OpenCall, "status" | "call_date">, role: CallRole | undefined, now = new Date()): string | null {
  if (call.status === "closed") return "Closed";
  if (!roleOpen(role)) return "Role filled";
  if (call.call_date.slice(0, 10) < utcDay(now)) return "Date passed";
  return null;
}

/** City key and label for a typed city. Only a city: no street, venue or address. */
export function callCity(typed: string): { key: string; label: string } | null {
  const resolved = resolveCity(typed);
  const key = resolved.city_key;
  const label = (resolved.city_display || typed).trim();
  if (!key || !CITY_KEY.test(key) || !label || label.length > 80) return null;
  return { key, label };
}

export interface CallDraft {
  roleId: string | null;
  newRole: string;
  date: string;
  city: string;
  description: string;
}

export function callDraftError(draft: CallDraft, now = new Date()): string | null {
  if (!draft.roleId) {
    const name = draft.newRole.trim();
    if (!name) return "Pick a role or name a new one";
    if (name.length > 60) return "Keep the role name to 60 characters";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return "Pick a date";
  const today = utcDay(now);
  if (draft.date < today || draft.date > addDays(today, CALL_MAX_DAYS)) return "Pick a date in the next 12 months";
  if (!callCity(draft.city)) return "Add the city (just the city, no address)";
  if (draft.description.trim().length > CALL_NOTE_MAX) return `Keep the description to ${CALL_NOTE_MAX} characters`;
  return null;
}

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function callDateLabel(day: string): string {
  return DAY.format(new Date(`${day.slice(0, 10)}T00:00:00Z`));
}

/** Where Apply goes: the project page with the role picked. */
export function callApplyHref(call: Pick<NearbyCall, "project_id" | "role_id">): string {
  return `/project/${call.project_id}?role=${encodeURIComponent(call.role_id)}`;
}
