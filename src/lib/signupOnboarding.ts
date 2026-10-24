/** Account creation keeps these and then opens the app. Tools and roles are not asked. */
export const SIGNUP_ONBOARDING_STEPS = ["name", "passion", "city", "questionnaire"] as const;

export type SignupOnboardingStep = (typeof SIGNUP_ONBOARDING_STEPS)[number];

export function signupOnboardingAsksForTools(): boolean {
  return (SIGNUP_ONBOARDING_STEPS as readonly string[]).some((step) =>
    step === "skills" || step === "roles" || step === "tools" || step === "connections" || step === "completion",
  );
}

/**
 * Drafts written before tools were removed used:
 * 0 intro, 1 name, 2 passion, 3 city, 4 roles, 5 questionnaire, 6 connections.
 * Version 2 drafts already use the shorter list.
 */
export function migrateOnboardingDraftStep(step: number, version: number | undefined): number {
  const last = SIGNUP_ONBOARDING_STEPS.length - 1;
  const raw = Number.isFinite(step) ? Math.trunc(step) : 0;
  if (version === 2) return Math.min(last, Math.max(0, raw));
  if (raw <= 1) return 0;
  if (raw === 2) return 1;
  if (raw === 3) return 2;
  return last;
}
