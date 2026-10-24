export const ETHER_ID_STATUSES = ["Active", "Inactive", "Suspended", "Banned"] as const;
export type EtherIdStatus = (typeof ETHER_ID_STATUSES)[number];

export interface EtherIdPublic {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  photo_url?: string | null;
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
  id_photo_url: string | null;
  city?: string | null;
  token: string;
  verify_path: string;
}

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

export const PUBLIC_VERIFY_KEYS = [
  "display_name",
  "username",
  "avatar_url",
  "photo_url",
  "status",
  "member_since",
  "member_since_label",
] as const;

/** The card shows a chosen ID photo, then the profile picture. */
export function cardPhoto(card: { photo_url?: string | null; avatar_url?: string | null }) {
  return card.photo_url || card.avatar_url || null;
}

/** LAST, REST from the real display name. No rank is added. */
export function personnelName(displayName: string | null | undefined) {
  const clean = (displayName || "").trim().replace(/\s+/g, " ");
  if (!clean) return "NAME NOT SET";
  const parts = clean.split(" ");
  if (parts.length === 1) return parts[0].toUpperCase();
  const last = parts[parts.length - 1].toUpperCase();
  const rest = parts.slice(0, -1).join(" ").toUpperCase();
  return `${last}, ${rest}`;
}

export const ETHER_ID_QR_SIZE = 96;

/** Light modules on the card ground. Quiet zone is marginSize modules inside size. */
export function etherIdQr(value: string) {
  return {
    value,
    size: ETHER_ID_QR_SIZE,
    level: "M" as const,
    marginSize: 2,
    bgColor: "#ffffff",
    fgColor: "#141416",
  };
}

function plateHash(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Stable display code. Not a secret and not the verify token. */
export function memberCode(username: string | null | undefined, memberSince: string | null | undefined) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // cspell:disable-line
  let n = plateHash(`${username || "member"}|${memberSince || ""}`);
  let out = "";
  for (let i = 0; i < 4; i += 1) {
    out += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length);
  }
  return `ETR.${out}`;
}

/** Eight digits grouped like the plate's serial. Derived from the same public fields. */
export function memberNumber(username: string | null | undefined, memberSince: string | null | undefined) {
  const digits = String(plateHash(`n|${username || ""}|${memberSince || ""}`) % 100000000).padStart(8, "0");
  return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
}

export function isPublicVerifyCard(value: Record<string, unknown>) {
  const keys = Object.keys(value);
  return keys.every((key) => (PUBLIC_VERIFY_KEYS as readonly string[]).includes(key));
}
