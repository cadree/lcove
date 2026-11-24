/** Keep equal to supabase/functions/_shared/seller-payment-setup.mjs. */
export const SELLER_SETUP_INCOMPLETE_MESSAGE =
  "This seller hasn't finished payment setup yet, so card checkout isn't available. Check back soon.";

/** True when a checkout function refused because the seller or host can't be paid directly yet. */
export function sellerSetupIncomplete(result: unknown): boolean {
  return typeof result === "object" && result !== null && (result as { needs_connect?: unknown }).needs_connect === true;
}
