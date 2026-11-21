/** Admin member directory: filters, quick views, bulk-action plans. No React here. */

export type MemberStatus = "pending" | "active" | "denied" | "banned";
export type MemberSort = "joined" | "name" | "active" | "city" | "level";
export type SortDir = "asc" | "desc";
export type ActiveWindow = "7d" | "30d" | "inactive_30d" | "never";
export type RemovedMode = "hide" | "only" | "all";

export interface MemberFilters {
  q?: string;
  status?: MemberStatus;
  level?: 1 | 2 | 3;
  role?: "admin" | "member";
  city?: string;
  joined_from?: string;
  joined_to?: string;
  active?: ActiveWindow;
  suspended?: "yes" | "no";
  removed?: RemovedMode;
}

export interface AdminMember {
  user_id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  mindset_level: number | null;
  access_status: string | null;
  onboarding_completed: boolean;
  created_at: string | null;
  last_active_at: string | null;
  is_suspended: boolean;
  suspension_reason: string | null;
  deleted_at: string | null;
  is_admin: boolean;
  credit_balance: number;
}

export interface MemberPage {
  total: number;
  rows: AdminMember[];
}

export type BulkAction =
  | "suspend"
  | "unsuspend"
  | "ban"
  | "unban"
  | "remove"
  | "restore"
  | "set_level"
  | "message";

export interface BulkBefore {
  user_id: string;
  mindset_level: number | null;
  is_suspended: boolean;
  suspension_reason: string | null;
  deleted_at: string | null;
  access_status: string | null;
}

export interface BulkResult {
  action: BulkAction;
  requested: number;
  succeeded: number;
  failed: number;
  errors: { user_id: string; error: string }[];
  done: string[];
  before: BulkBefore[];
}

export interface QuickView {
  id: string;
  label: string;
  filters: MemberFilters;
}

export const QUICK_VIEWS: QuickView[] = [
  { id: "everyone", label: "Everyone", filters: {} },
  { id: "pending", label: "Pending", filters: { status: "pending" } },
  { id: "new", label: "Joined this week", filters: { joined_from: "__7d" } },
  { id: "active", label: "Active this week", filters: { active: "7d" } },
  { id: "quiet", label: "Quiet 30+ days", filters: { active: "inactive_30d" } },
  { id: "suspended", label: "Suspended", filters: { suspended: "yes" } },
  { id: "admins", label: "Admins", filters: { role: "admin" } },
  { id: "removed", label: "Removed", filters: { removed: "only" } },
];

/** The server caps one bulk call at 500 people. */
export const BULK_CHUNK = 500;
export const PAGE_SIZES = [25, 50, 100] as const;

const DAY_MS = 86_400_000;

/** Turn relative tokens into dates and drop empty values, so the query key is stable. */
export function resolveFilters(filters: MemberFilters, now: Date = new Date()): MemberFilters {
  const out: MemberFilters = {};
  for (const [key, raw] of Object.entries(filters) as [keyof MemberFilters, unknown][]) {
    if (raw === undefined || raw === null || raw === "") continue;
    let value: unknown = raw;
    if (typeof raw === "string") {
      const text = raw.trim();
      if (text === "") continue;
      const rel = /^__(\d+)d$/.exec(text);
      value = rel ? new Date(now.getTime() - Number(rel[1]) * DAY_MS).toISOString().slice(0, 10) : text;
    }
    (out as Record<string, unknown>)[key] = value;
  }
  if (out.removed === "hide") delete out.removed;
  return out;
}

export function activeFilterCount(filters: MemberFilters): number {
  return Object.entries(resolveFilters(filters)).filter(([key]) => key !== "q").length;
}

export function sameFilters(a: MemberFilters, b: MemberFilters): boolean {
  const left = resolveFilters(a, new Date(0));
  const right = resolveFilters(b, new Date(0));
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left as Record<string, unknown>)[key] !== (right as Record<string, unknown>)[key]) return false;
  }
  return true;
}

export function chunk<T>(items: T[], size: number = BULK_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Fold the per-chunk replies from the server into one result. */
export function mergeResults(action: BulkAction, parts: BulkResult[]): BulkResult {
  return parts.reduce<BulkResult>(
    (all, part) => ({
      action,
      requested: all.requested + part.requested,
      succeeded: all.succeeded + part.succeeded,
      failed: all.failed + part.failed,
      errors: [...all.errors, ...part.errors],
      done: [...all.done, ...part.done],
      before: [...all.before, ...part.before],
    }),
    { action, requested: 0, succeeded: 0, failed: 0, errors: [], done: [], before: [] },
  );
}

const PAST: Record<BulkAction, string> = {
  suspend: "Suspended",
  unsuspend: "Unsuspended",
  ban: "Banned",
  unban: "Unbanned",
  remove: "Removed",
  restore: "Restored",
  set_level: "Updated level for",
  message: "Messaged",
};

/** "Suspended 12, 1 failed" */
export function resultSummary(result: Pick<BulkResult, "action" | "succeeded" | "failed">): string {
  const base = `${PAST[result.action]} ${result.succeeded}`;
  return result.failed > 0 ? `${base}, ${result.failed} failed` : base;
}

export interface UndoStep {
  action: BulkAction;
  userIds: string[];
  payload?: Record<string, unknown>;
}

/**
 * What it takes to put people back the way they were. Only people the action
 * actually changed are touched. Messages cannot be unsent.
 */
export function undoPlan(result: BulkResult): UndoStep[] {
  const done = new Set(result.done);
  const before = result.before.filter((row) => done.has(row.user_id));
  switch (result.action) {
    case "suspend": {
      const ids = before.filter((row) => !row.is_suspended).map((row) => row.user_id);
      return ids.length ? [{ action: "unsuspend", userIds: ids }] : [];
    }
    case "unsuspend": {
      const ids = before.filter((row) => row.is_suspended).map((row) => row.user_id);
      return ids.length ? [{ action: "suspend", userIds: ids }] : [];
    }
    case "remove": {
      const ids = before.filter((row) => !row.deleted_at).map((row) => row.user_id);
      return ids.length ? [{ action: "restore", userIds: ids }] : [];
    }
    case "restore": {
      const ids = before.filter((row) => !!row.deleted_at).map((row) => row.user_id);
      return ids.length ? [{ action: "remove", userIds: ids }] : [];
    }
    case "ban": {
      const ids = before.filter((row) => row.access_status !== "banned").map((row) => row.user_id);
      return ids.length ? [{ action: "unban", userIds: ids }] : [];
    }
    case "unban": {
      const ids = before.filter((row) => row.access_status === "banned").map((row) => row.user_id);
      return ids.length ? [{ action: "ban", userIds: ids }] : [];
    }
    case "set_level": {
      const byLevel = new Map<number, string[]>();
      for (const row of before) {
        if (row.mindset_level !== 1 && row.mindset_level !== 2 && row.mindset_level !== 3) continue;
        byLevel.set(row.mindset_level, [...(byLevel.get(row.mindset_level) ?? []), row.user_id]);
      }
      return [...byLevel.entries()].map(([level, userIds]) => ({ action: "set_level", userIds, payload: { level } }));
    }
    case "message":
      return [];
  }
}

export function memberLabel(member: Pick<AdminMember, "display_name" | "email">): string {
  return member.display_name?.trim() || member.email || "Unnamed";
}

export type StandingTone = "removed" | "banned" | "suspended" | "pending" | "denied" | "active";

export function standing(member: Pick<AdminMember, "deleted_at" | "access_status" | "is_suspended">): StandingTone {
  if (member.deleted_at) return "removed";
  if (member.access_status === "banned") return "banned";
  if (member.is_suspended) return "suspended";
  if (member.access_status === "denied") return "denied";
  if (member.access_status === "active") return "active";
  return "pending";
}

/** Which bulk actions make sense for the current view. Removed people can only be restored. */
export function bulkActionsFor(filters: MemberFilters): BulkAction[] {
  if (filters.removed === "only") return ["restore"];
  return ["message", "suspend", "unsuspend", "set_level", "ban", "unban", "remove"];
}

export const DESTRUCTIVE: ReadonlySet<BulkAction> = new Set(["remove", "ban", "suspend"]);
