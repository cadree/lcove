/** Inviting someone to a project, gig or event that already exists. Pure helpers, no I/O. */

export type InviteKind = "project" | "event";
export type InviteSection = "yours" | "nearby";
/** What item_invite_targets says about the invitee for one row. */
export type InviteState = "available" | "invited" | "member" | "going" | "host";

export interface InviteTarget {
  item_type: InviteKind;
  item_id: string;
  title: string;
  cover_url: string | null;
  starts_at: string | null;
  place: string | null;
  section: InviteSection;
  role: "host" | "member" | "going" | null;
  state: InviteState;
}

export type SendResult =
  | { status: "sent"; id: string; notified: boolean }
  | { status: "already_invited"; id: string }
  | { status: "already_in"; state: InviteState };

const KINDS = new Set<InviteKind>(["project", "event"]);
const STATES = new Set<InviteState>(["available", "invited", "member", "going", "host"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keep only well-formed rows from the RPC, in the order it sent them. */
export function parseTargets(raw: unknown): InviteTarget[] {
  if (!Array.isArray(raw)) return [];
  const rows: InviteTarget[] = [];
  for (const value of raw) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const kind = row.item_type as InviteKind;
    const id = row.item_id;
    if (!KINDS.has(kind) || typeof id !== "string" || !UUID.test(id)) continue;
    const title = typeof row.title === "string" && row.title.trim() ? row.title.trim() : kind === "event" ? "Untitled event" : "Untitled project";
    const role = row.role === "host" || row.role === "member" || row.role === "going" ? row.role : null;
    rows.push({
      item_type: kind,
      item_id: id,
      title,
      cover_url: typeof row.cover_url === "string" && /^https:\/\//i.test(row.cover_url) ? row.cover_url : null,
      starts_at: typeof row.starts_at === "string" ? row.starts_at : null,
      place: typeof row.place === "string" && row.place.trim() ? row.place.trim() : null,
      section: row.section === "yours" ? "yours" : "nearby",
      role,
      state: STATES.has(row.state as InviteState) ? (row.state as InviteState) : "available",
    });
  }
  return rows;
}

export function splitTargets(rows: InviteTarget[]): { yours: InviteTarget[]; nearby: InviteTarget[] } {
  return {
    yours: rows.filter((row) => row.section === "yours"),
    nearby: rows.filter((row) => row.section === "nearby"),
  };
}

/** Button text and whether the row can be tapped. `sent` is this session's taps. */
export function rowAction(row: InviteTarget, sent: ReadonlySet<string>, firstName: string): { label: string; disabled: boolean; done: boolean } {
  if (sent.has(row.item_id)) return { label: "Sent", disabled: true, done: true };
  switch (row.state) {
    case "invited":
      return { label: "Invited", disabled: true, done: true };
    case "member":
      return { label: "Already in", disabled: true, done: false };
    case "going":
      return { label: "Going", disabled: true, done: false };
    case "host":
      return { label: row.item_type === "event" ? "Their event" : "Their project", disabled: true, done: false };
    default:
      return { label: `Invite ${firstName}`.trim(), disabled: false, done: false };
  }
}

export function roleTag(row: InviteTarget): string | null {
  if (row.role === "host") return row.item_type === "event" ? "Hosting" : "Yours";
  if (row.role === "member") return "Member";
  if (row.role === "going") return "Going";
  return null;
}

/** "Sat, Nov 21 · 8:00 PM" for events, "Starts Nov 21" for projects (a date with no time). */
export function whenLabel(row: Pick<InviteTarget, "item_type" | "starts_at">, timeZone?: string): string | null {
  if (!row.starts_at) return null;
  if (row.item_type === "project") {
    const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(row.starts_at);
    if (!day) return null;
    const date = new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12));
    return `Starts ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date)}`;
  }
  const at = new Date(row.starts_at);
  if (Number.isNaN(at.getTime())) return null;
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone }).format(at);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(at);
  return `${day} · ${time}`;
}

export function detailLine(row: InviteTarget, timeZone?: string): string {
  return [whenLabel(row, timeZone), row.place].filter(Boolean).join(" · ");
}

export function parseSendResult(raw: unknown): SendResult {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (value.status === "already_invited") return { status: "already_invited", id: String(value.id ?? "") };
  if (value.status === "already_in") {
    const state = STATES.has(value.state as InviteState) ? (value.state as InviteState) : "member";
    return { status: "already_in", state };
  }
  return { status: "sent", id: String(value.id ?? ""), notified: value.notified !== false };
}

/** Toast copy after a tap. */
export function sendToast(result: SendResult, firstName: string, title: string): string {
  if (result.status === "already_invited") return `${firstName} already has an invite to ${title}`;
  if (result.status === "already_in") return `${firstName} is already in ${title}`;
  return `Invite sent to ${firstName}`;
}

export interface ItemInviteNotice {
  inviteId: string;
  kind: InviteKind;
  path: string;
  /** The invitee can still say yes or no. False on the sender's "accepted" notice. */
  answerable: boolean;
  accepted: boolean | null;
}

/** Read an item_invite notification's data. Paths are only ever /project/<id> or /event/<id>. */
export function itemInviteNotice(notification: { type: string; data: Record<string, unknown> | null | undefined }): ItemInviteNotice | null {
  if (notification.type !== "item_invite") return null;
  const data = notification.data ?? {};
  const kind = data.item_type as InviteKind;
  const itemId = data.item_id;
  const inviteId = data.invite_id;
  if (!KINDS.has(kind) || typeof itemId !== "string" || !UUID.test(itemId)) return null;
  if (typeof inviteId !== "string" || !UUID.test(inviteId)) return null;
  const accepted = typeof data.accepted === "boolean" ? data.accepted : null;
  return {
    inviteId,
    kind,
    path: `/${kind}/${itemId}`,
    answerable: data.answer !== true && accepted === null,
    accepted,
  };
}

export function joinLabel(kind: InviteKind): string {
  return kind === "event" ? "RSVP" : "Join";
}

export function createHref(kind: InviteKind): string {
  return kind === "event" ? "/calendar?action=create" : "/projects?action=create";
}

export function pickerCopy(kind: InviteKind, firstName: string) {
  return kind === "event"
    ? {
        title: `Invite ${firstName} to an event`,
        yoursHeading: "Your events",
        nearbyHeading: "Happening near you",
        emptyYours: "You have no upcoming events.",
        emptyNearby: "No public events listed in your city right now.",
        create: "Create a new event",
      }
    : {
        title: `Invite ${firstName} to a project or gig`,
        yoursHeading: "Your projects and gigs",
        nearbyHeading: "Open near you",
        emptyYours: "You have no open projects or gigs.",
        emptyNearby: "No open projects or gigs listed in your city right now.",
        create: "Create a new project or gig",
      };
}
