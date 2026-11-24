export const SUPPORT_ETHER_LABEL = "Support Ether";
export const SUPPORT_IN_SAFARI_LABEL = "Support in Safari";
export const SUPPORT_NOW_LABEL = "Support now";

export function supportCadenceLabel(mode: "one_time" | "recurring") {
  return mode === "recurring" ? "Monthly support" : "One-time support";
}

/** Checkout action inside the support dialog. Safari still opens outside the app. */
export function supportCheckoutLabel(loading: boolean) {
  return loading ? "Redirecting..." : SUPPORT_ETHER_LABEL;
}

/** Shown wherever someone can pay to support ETHER. Keep it plain: this money goes to ETHER, not to creators. */
export const SUPPORT_PAYMENT_DISCLOSURE =
  "Support is an optional payment to ETHER, the company behind the app. It isn't a charitable donation, isn't tax-deductible, and isn't a tip to any creator.";

/** Shown under live-stream card gifts, which are paid to the host. */
export const CARD_GIFT_DISCLOSURE =
  "By sending a card gift, you agree to tip the host for this live stream. Gifts are paid to the host through Stripe, and ETHER keeps 10%.";
