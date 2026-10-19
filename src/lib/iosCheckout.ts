/**
 * What the iOS app may open in Stripe.
 *
 * Digital goods (memberships, exclusive music, cinema and artist subscriptions,
 * live-stream tips of LC) are hidden. There is no "buy on the web" button.
 * An external purchase link for digital goods needs Apple's entitlement and
 * the required disclosure, including outside the US. Hiding them is the setup
 * that can ship worldwide without that approval.
 *
 * Donations are off (`IOS_DONATIONS_ENABLED`). A Stripe donation inside the
 * app is an in-app payment. Turn the flag back on only after Apple accepts a
 * nonprofit donation exception. Membership stays hidden either way.
 *
 * Real-world event tickets, physical store goods, and services used outside
 * the app (studio rental, bookings) may use Stripe. Guideline 3.1.3(e)
 * requires a payment method other than In-App Purchase for those.
 */
export const IOS_DONATIONS_ENABLED = false;

export type StripeCheckoutKind =
  | "digital"
  | "donation"
  | "physical_good"
  | "real_world_service"
  | "event_ticket";

export function allowsStripeCheckout(isIos: boolean, kind: StripeCheckoutKind): boolean {
  if (!isIos) return true;
  if (kind === "digital") return false;
  if (kind === "donation") return IOS_DONATIONS_ENABLED;
  return true;
}
