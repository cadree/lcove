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
