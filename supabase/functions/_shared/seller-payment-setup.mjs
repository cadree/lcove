// Card sales on Ether are destination charges to the seller's or host's connected Stripe account.
// When that account can't accept charges yet, checkout is refused. Ether never collects a
// creator sale on its own account to pay out later. Keep the message equal to
// src/lib/sellerPaymentSetup.ts.

export const SELLER_SETUP_INCOMPLETE_MESSAGE =
  "This seller hasn't finished payment setup yet, so card checkout isn't available. Check back soon.";

export function sellerSetupIncompleteBody() {
  return { needs_connect: true, error: SELLER_SETUP_INCOMPLETE_MESSAGE };
}
