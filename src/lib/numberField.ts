/**
 * Reads a typed number field at submit time. Fields keep the raw string while
 * the person types (so they can clear and retype); this turns it into a
 * number, or a message to show, without ever producing NaN.
 */
export interface NumberRules {
  label: string;
  min?: number;
  max?: number;
  integer?: boolean;
  /** Empty is allowed and reads as null. */
  optional?: boolean;
  /** Round to this many decimals, e.g. 2 for money. */
  decimals?: number;
}

/** `error` is set when the field is unusable; otherwise `value` (null for an empty optional field). */
export interface NumberRead {
  value: number | null;
  error: string | null;
}

const format = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

export function readNumber(draft: string | number | null | undefined, rules: NumberRules): NumberRead {
  const text = typeof draft === "number" ? String(draft) : (draft ?? "").replace(/[\s,$€£]/g, "");
  if (text === "") {
    return rules.optional ? { value: null, error: null } : { value: null, error: `Enter ${rules.label.toLowerCase()}` };
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return { value: null, error: `${rules.label} must be a number` };
  if (rules.integer && !Number.isInteger(parsed)) return { value: null, error: `${rules.label} must be a whole number` };
  const value = rules.decimals === undefined ? parsed : Number(parsed.toFixed(rules.decimals));
  if (rules.min !== undefined && value < rules.min) return { value: null, error: `${rules.label} must be at least ${format(rules.min)}` };
  if (rules.max !== undefined && value > rules.max) return { value: null, error: `${rules.label} must be at most ${format(rules.max)}` };
  return { value, error: null };
}

/** Money in whole cents, without float drift (19.99 → 1999). */
export function toCents(amount: number): number {
  return Math.round(Number((amount * 100).toFixed(4)));
}
