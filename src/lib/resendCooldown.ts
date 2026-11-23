// Match the standard one-minute Auth resend frequency guard.
export const RESEND_COOLDOWN_MS = 60_000;

export function resendCooldownRemaining(
  sentAtMs: number | null,
  nowMs: number,
  cooldownMs = RESEND_COOLDOWN_MS,
): number {
  if (sentAtMs == null) return 0;
  const remaining = sentAtMs + cooldownMs - nowMs;
  return remaining > 0 ? remaining : 0;
}
