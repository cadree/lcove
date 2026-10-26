export const ETHER_ID_STATUSES = ["Active", "Inactive", "Suspended", "Banned"] as const;
export type EtherIdStatus = (typeof ETHER_ID_STATUSES)[number];

export interface EtherIdPublic {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  status: EtherIdStatus;
  member_since: string | null;
  member_since_label: string | null;
}

export interface EtherIdCard extends EtherIdPublic {
  passion: string | null;
  peer_review_average: number | null;
  peer_review_count: number;
  peer_review_label: string;
  projects_completed: number;
  projects_label: string;
  birthday_label: string | null;
  birthday_note: string | null;
  show_birthday: boolean;
  birthday_month: number | null;
  birthday_day: number | null;
  member_of: string | null;
  city: string | null;
  token: string;
  verify_path: string;
}

export const MEMBER_OF_LIMIT = 24;
export const MEMBER_OF_EMPTY = "LCOVE";
export const MEMBER_OF_HINT = "A community or personal brand you belong to, or N/A or LCOVE.";
export const ETHER_ID_SITE = "etherbylcove.com";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Same rule as public.ether_member_status.
 * Banned and suspended come from admin actions. Active also requires a
 * finished account seen in the last 30 days, the audience activity window.
 */
export function memberStatus(input: {
  accessStatus: string | null;
  isSuspended: boolean | null;
  onboardingCompleted: boolean | null;
  lastActiveAt: string | null;
  now?: Date;
}): EtherIdStatus {
  if (input.accessStatus === "banned") return "Banned";
  if (input.isSuspended) return "Suspended";
  const now = input.now ?? new Date();
  const activeAt = input.lastActiveAt ? new Date(input.lastActiveAt) : null;
  const withinThirtyDays = !!activeAt && now.getTime() - activeAt.getTime() <= 30 * 24 * 60 * 60 * 1000;
  if (input.accessStatus === "active" && input.onboardingCompleted && withinThirtyDays) return "Active";
  return "Inactive";
}

export function usernameAt(username: string | null | undefined) {
  if (!username) return null;
  return `@${username.replace(/^@+/, "")}`;
}

/** First named creative role, in the order the profile already returns them. */
export function firstRoleName(roles: { name?: string | null }[] | null | undefined) {
  for (const role of roles ?? []) {
    const name = (role.name ?? "").trim().replace(/\s+/g, " ");
    if (name) return name;
  }
  return null;
}

/** In-app card line under the name. A role prefixes the handle. */
export function cardHandleLine(role: string | null | undefined, username: string | null | undefined) {
  const handle = usernameAt(username) || "No username yet";
  const title = (role ?? "").trim().replace(/\s+/g, " ");
  if (!title) return handle;
  return `${title} · ${handle}`;
}

/** Month and day only. Never a year, never an age. */
export function birthdayFace(card: { birthday_label: string | null; birthday_note: string | null }) {
  if (!card.birthday_label) return null;
  return {
    label: card.birthday_label,
    note: card.birthday_note || "self-reported",
  };
}

export function normalizeUsername(raw: string) {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export function usernameError(raw: string) {
  const name = normalizeUsername(raw);
  if (!name) return null;
  if (!/^[a-z0-9_]{3,20}$/.test(name)) {
    return "Use 3 to 20 letters, numbers, or underscores.";
  }
  return null;
}

export function birthdayError(month: number | null, day: number | null) {
  if (month == null && day == null) return null;
  if (month == null || day == null) return "Choose a month and a day.";
  const date = new Date(Date.UTC(2024, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return "That is not a real month and day.";
  }
  return null;
}

export function walletButtonVisible(configured: boolean | undefined) {
  return configured === true;
}

export function verifyUrl(origin: string, verifyPath: string) {
  return `${origin.replace(/\/$/, "")}${verifyPath}`;
}

export function normalizeMemberOf(raw: string | null | undefined) {
  const trimmed = (raw ?? "").trim();
  return trimmed ? trimmed : null;
}

export function memberOfError(raw: string | null | undefined) {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length > MEMBER_OF_LIMIT) return "Member of is 24 characters or fewer.";
  return null;
}

/** Empty, blank, and missing all print as LCOVE. A typed value prints as typed. */
export function memberOfFace(raw: string | null | undefined) {
  return normalizeMemberOf(raw) || MEMBER_OF_EMPTY;
}

/** Two initials on the dark plate when a member has no photo. */
export function cardInitials(displayName: string | null | undefined) {
  const parts = (displayName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "E";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

/** LAST, then the rest, from the real display name. */
export function cardNameLines(displayName: string | null | undefined): [string, string | null] {
  const clean = (displayName || "").trim().replace(/\s+/g, " ");
  if (!clean) return ["Name not set", null];
  if (clean.includes(",")) {
    const [last, ...rest] = clean.split(",");
    const first = rest.join(",").trim();
    return [last.trim() || clean, first || null];
  }
  const parts = clean.split(" ");
  if (parts.length === 1) return [parts[0], null];
  return [parts[parts.length - 1], parts.slice(0, -1).join(" ")];
}

/** First word of the passion, then the city. Both come from the member. */
export function cardKicker(passion: string | null | undefined, city: string | null | undefined) {
  const discipline = (passion || "").trim().split(/\s+/)[0] || "";
  const place = (city || "").trim();
  const parts = [discipline, place].filter(Boolean);
  if (!parts.length) return null;
  return `— ${parts.join(" · ")}`;
}

export function memberSinceShort(memberSince: string | null | undefined, label?: string | null) {
  const match = /^(\d{4})-(\d{2})/.exec(memberSince || "");
  if (match) {
    const month = SHORT_MONTHS[Number(match[2]) - 1];
    if (month) return `${month} ${match[1]}`;
  }
  const fromLabel = /^([A-Za-z]+)\s+(\d{4})$/.exec((label || "").trim());
  if (fromLabel) return `${fromLabel[1].slice(0, 3)} ${fromLabel[2]}`;
  return "—";
}

export function reviewsFace(average: number | null | undefined, count: number | null | undefined) {
  const reviews = count ?? 0;
  if (!reviews || average == null || Number.isNaN(Number(average))) return "—";
  const rounded = Number(average);
  const text = Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded);
  return `${text} · ${reviews}`;
}

export const PUBLIC_VERIFY_KEYS = [
  "display_name",
  "username",
  "avatar_url",
  "status",
  "member_since",
  "member_since_label",
] as const;

export function isPublicVerifyCard(value: Record<string, unknown>) {
  const keys = Object.keys(value);
  return keys.every((key) => (PUBLIC_VERIFY_KEYS as readonly string[]).includes(key));
}
