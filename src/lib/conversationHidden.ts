/**
 * "Delete Chat" hides a conversation for the signed-in member only. A hidden
 * chat comes back as soon as a message newer than the hide arrives.
 */
export function isHiddenForMe(hiddenAt: string | null | undefined, lastMessageAt: string | null | undefined): boolean {
  if (!hiddenAt) return false;
  if (!lastMessageAt) return true;
  return new Date(lastMessageAt).getTime() <= new Date(hiddenAt).getTime();
}
