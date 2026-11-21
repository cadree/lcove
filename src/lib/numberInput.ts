/** Empty/invalid drafts restore the prior value, with bounds enforced on commit. */
export function commitNumber(draft: string, previous: number, min?: string | number, max?: string | number, integer = false): number {
  const parsed = draft.trim() === '' ? NaN : Number(draft);
  let value = Number.isFinite(parsed) ? parsed : previous;
  if (integer) value = Math.trunc(value);
  if (min !== undefined && Number.isFinite(Number(min))) value = Math.max(Number(min), value);
  if (max !== undefined && Number.isFinite(Number(max))) value = Math.min(Number(max), value);
  return value;
}
