/** Basic objectionable-text filter for posts, comments, messages, live chat, and profiles. */

export const OBJECTIONABLE_MESSAGE = "That text isn't allowed.";

const BANNED_TOKENS = [
  "porn",
  "porno",
  "xxx",
  "nude",
  "nudes",
  "slut",
  "whore",
  "faggot",
  "nigger",
  "nigga",
  "retard",
  "kike",
] as const;

const BANNED_PHRASES = ["kill yourself"] as const;

export function normalizeObjectionableText(value: string): string {
  const leet = value
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/@/g, "a")
    .replace(/\$/g, "s");
  return leet.replace(/[^a-z]+/g, " ").replace(/\s+/g, " ").trim();
}

export function objectionableMessage(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const normalized = normalizeObjectionableText(value);
  if (!normalized) return null;
  if (BANNED_PHRASES.some((phrase) => ` ${normalized} `.includes(` ${phrase} `))) {
    return OBJECTIONABLE_MESSAGE;
  }
  const tokens = new Set(normalized.split(" "));
  if (BANNED_TOKENS.some((token) => tokens.has(token))) return OBJECTIONABLE_MESSAGE;
  return null;
}

export function assertCleanText(value: string | null | undefined) {
  const message = objectionableMessage(value);
  if (message) throw new Error(message);
}
