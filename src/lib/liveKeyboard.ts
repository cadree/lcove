/** Bottom inset for the live sheet while the native keyboard is open. */
export function liveKeyboardInset(height: number | null | undefined): number {
  if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) return 0;
  return Math.round(height);
}
