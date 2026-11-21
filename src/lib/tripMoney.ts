/** Money is represented in integer cents; pledges are never payment confirmation. */
export function parseCents(raw: string): number | null {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw.trim())) return null;
  const [whole, fraction = ""] = raw.trim().split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents <= 100000000 ? cents : null;
}
export function equalShares(
  total: number,
  ids: string[]
): Record<string, number> {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !ids.length ||
    new Set(ids).size !== ids.length
  )
    throw new Error("Invalid budget or roster");
  return Object.fromEntries(
    [...ids]
      .sort()
      .map((id, i) => [
        id,
        Math.floor(total / ids.length) + (i < total % ids.length ? 1 : 0),
      ])
  );
}
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100
  );
export function safeWebLink(
  value: string | null | undefined
): string | undefined {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
