/** In-the-moment connect celebration and the nudge that stays after it. No new tables. */

export const CONNECT_NUDGE_EVENT = "ether-connect-nudge";
export const CONNECT_NUDGE_LIMIT = 12;

export type Store = Pick<Storage, "getItem" | "setItem">;

export interface IcebreakerPerson {
  name: string;
  skills: string[];
  passions: string[];
  role?: string | null;
  city?: string | null;
  tripCity?: string | null;
}

export interface IcebreakerMe {
  skills: string[];
  passions: string[];
  city?: string | null;
}

export interface ConnectNudge {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string | null;
  skills: string[];
  passions: string[];
  city: string | null;
  tripCity: string | null;
  matched: boolean;
  conversationId: string | null;
  started: boolean;
  at: number;
}

const storageKey = (viewerId: string) => `ether:connect-nudge:${viewerId}`;

function emit(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONNECT_NUDGE_EVENT));
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim() || "them";
}

export function cityName(value: string | null | undefined): string {
  return (value || "").split(",")[0].trim();
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function firstShared(theirs: string[], mine: string[] | undefined): string | null {
  if (!mine?.length) return null;
  const have = new Set(mine.map(norm).filter(Boolean));
  return theirs.find((item) => have.has(norm(item))) || null;
}

/** Plain templates from shared niches or a city. Never generative. */
export function icebreaker(person: IcebreakerPerson, me?: IcebreakerMe | null): string {
  const name = firstName(person.name);
  const skill = firstShared(person.skills, me?.skills);
  if (skill) return `Hey ${name}, we both work in ${skill}. Want to make something together?`;
  const passion = firstShared(person.passions, me?.passions);
  if (passion) return `Hey ${name}, we both care about ${passion}. Want to start a project around that?`;
  const trip = cityName(person.tripCity);
  if (trip) return `Hey ${name}, I saw you're traveling to ${trip}. Want to plan something there?`;
  const theirs = cityName(person.city);
  if (theirs && norm(theirs) === norm(cityName(me?.city))) {
    return `Hey ${name}, we're both in ${theirs}. Want to meet up or start a project?`;
  }
  if (person.role) return `Hey ${name}, your ${person.role} work looks great. Want to team up?`;
  return `Hey ${name}, I'd love to connect and make something together.`;
}

export function celebrationEyebrow(matched: boolean): string {
  return matched ? "You connected" : "Connected";
}

/** Heading on the celebration overlay. A mutual match says both people connected. */
export function celebrationHeadline(nudge: Pick<ConnectNudge, "name" | "matched">): string {
  const name = firstName(nudge.name);
  return nudge.matched ? `You and ${name} both connected` : `You connected with ${name}`;
}

export function nudgeCopy(nudge: Pick<ConnectNudge, "name" | "matched">): string {
  return `You and ${firstName(nudge.name)} ${nudge.matched ? "matched" : "connected"}, start something`;
}

export function readNudges(store: Store, viewerId: string | undefined): ConnectNudge[] {
  if (!viewerId) return [];
  try {
    const raw = store.getItem(storageKey(viewerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNudge);
  } catch {
    return [];
  }
}

function isNudge(value: unknown): value is ConnectNudge {
  if (!value || typeof value !== "object") return false;
  const row = value as ConnectNudge;
  return typeof row.userId === "string" && typeof row.name === "string" && typeof row.at === "number";
}

function write(store: Store, viewerId: string, nudges: ConnectNudge[]): void {
  try {
    store.setItem(storageKey(viewerId), JSON.stringify(nudges.slice(0, CONNECT_NUDGE_LIMIT)));
  } catch {
    /* private mode: the nudge just does not persist */
  }
  emit();
}

export function addNudge(store: Store, viewerId: string | undefined, nudge: ConnectNudge): ConnectNudge[] {
  if (!viewerId) return [];
  const next = [nudge, ...readNudges(store, viewerId).filter((row) => row.userId !== nudge.userId)].slice(0, CONNECT_NUDGE_LIMIT);
  write(store, viewerId, next);
  return next;
}

export function dismissNudge(store: Store, viewerId: string | undefined, userId: string): ConnectNudge[] {
  if (!viewerId) return [];
  const next = readNudges(store, viewerId).filter((row) => row.userId !== userId);
  write(store, viewerId, next);
  return next;
}

export function markNudgeStarted(store: Store, viewerId: string | undefined, userId: string): ConnectNudge[] {
  return dismissNudge(store, viewerId, userId);
}

export function nudgeFor(nudges: ConnectNudge[], userId: string): ConnectNudge | undefined {
  return nudges.find((row) => row.userId === userId && !row.started);
}

export function travelCityParam(person: Pick<ConnectNudge, "tripCity" | "city">): string | null {
  return cityName(person.tripCity) || cityName(person.city) || null;
}

export function travelHref(person: Pick<ConnectNudge, "tripCity" | "city">): string {
  const city = travelCityParam(person);
  const params = new URLSearchParams({ action: "create" });
  if (city) params.set("city", city);
  return `/travel?${params.toString()}`;
}

export function messageHref(conversationId: string): string {
  return `/messages?conversation=${encodeURIComponent(conversationId)}`;
}
