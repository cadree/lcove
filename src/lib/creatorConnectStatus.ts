export type ConnectStatus = "pending" | "needs_info" | "accepting" | "review" | "verified";

export interface ConnectFlags {
  status?: string | null;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  transfers_active?: boolean | null;
  can_accept_charges?: boolean | null;
  currently_due?: string[] | null;
}

/** Wallet status. Accepting payments does not require payouts_enabled. */
export function resolveConnectStatus(state: ConnectFlags | null | undefined): ConnectStatus {
  if (!state) return "pending";
  if (state.payouts_enabled === true || state.status === "verified") return "verified";
  if ((state.currently_due?.length ?? 0) > 0 || state.status === "needs_info") return "needs_info";
  if (
    state.status === "accepting"
    || state.can_accept_charges === true
    || (state.charges_enabled === true && state.details_submitted === true && state.transfers_active !== false)
  ) {
    return "accepting";
  }
  if (state.details_submitted === true || state.status === "review") return "review";
  return "pending";
}

export function connectStatusLabel(status: ConnectStatus): string {
  if (status === "verified") return "Verified";
  if (status === "accepting") return "Accepting payments, payouts under review";
  if (status === "needs_info") return "Needs info";
  if (status === "review") return "Under review";
  return "Set up payouts";
}

export function connectStatusCopy(status: ConnectStatus): string {
  if (status === "verified") {
    return "Payouts are verified. Request a payout sends earned LC to this Stripe account.";
  }
  if (status === "accepting") {
    return "This account can accept card payments. Stripe is still reviewing bank payouts, so Request Payout stays off. No bank details are stored in Ether.";
  }
  if (status === "needs_info") {
    return "Stripe needs more information before payouts can be sent.";
  }
  if (status === "review") {
    return "Stripe has the payout details and is still reviewing them. No bank details are stored in Ether.";
  }
  return "Payout setup has not been finished. No bank details are stored in Ether.";
}

export function connectSetupAction(status: ConnectStatus): "setup" | "continue" | "manage" {
  if (status === "needs_info") return "continue";
  if (status === "pending") return "setup";
  return "manage";
}

export function withdrawalsEnabled(state: ConnectFlags | null | undefined): boolean {
  return state?.payouts_enabled === true || state?.status === "verified";
}
