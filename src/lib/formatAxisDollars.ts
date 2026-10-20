/** Chart axis labels. Values under $1,000 stay in dollars, so $7 is not $0.007k. */
export function formatAxisDollars(value: number): string {
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const scaled = abs / 1000;
    const rounded = scaled >= 100 ? Math.round(scaled) : Math.round(scaled * 10) / 10;
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${sign}$${text}k`;
  }
  if (abs >= 1) return `${sign}$${Math.round(abs)}`;
  return `${sign}$${abs.toFixed(2)}`;
}
