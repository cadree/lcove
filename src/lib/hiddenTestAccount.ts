/** Hide review and test profiles from discovery lists and the globe. */
export function isHiddenTestAccount(displayName: string | null | undefined): boolean {
  const name = (displayName ?? "").trim();
  if (!name) return false;
  return /app review/i.test(name) || /\btest account\b/i.test(name);
}
