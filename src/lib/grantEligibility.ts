/** Matches the membership page: grant eligibility after $50 contributed. */
export const GRANT_ELIGIBILITY_DOLLARS = 50;

export function isGrantEligible(lifetimeContribution: number | null | undefined): boolean {
  const amount = Number(lifetimeContribution || 0);
  return Number.isFinite(amount) && amount >= GRANT_ELIGIBILITY_DOLLARS;
}
