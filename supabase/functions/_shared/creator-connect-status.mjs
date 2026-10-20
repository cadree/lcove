/** Pure Connect status. Destination charges need charges plus transfers. Bank payouts are separate. */

export function transfersActive(account) {
  return account?.capabilities?.transfers === "active";
}

/** Card payments can be destination charges. Bank payouts are not required. */
export function canAcceptCharges(account) {
  return account?.charges_enabled === true && transfersActive(account);
}

export function classifyConnectAccount(account) {
  const due = [
    ...(account?.requirements?.currently_due ?? []),
    ...(account?.requirements?.past_due ?? []),
  ];
  const chargesEnabled = account?.charges_enabled === true;
  const payoutsEnabled = account?.payouts_enabled === true;
  const detailsSubmitted = account?.details_submitted === true;
  const transfers = transfersActive(account);
  const accepts = chargesEnabled && transfers;

  let status = "pending";
  if (!account) status = "pending";
  else if (payoutsEnabled) status = "verified";
  else if (due.length > 0) status = "needs_info";
  else if (accepts && detailsSubmitted) status = "accepting";
  else if (detailsSubmitted) status = "review";

  return {
    status,
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    details_submitted: detailsSubmitted,
    transfers_active: transfers,
    can_accept_charges: accepts,
    currently_due: due,
    disabled_reason: account?.requirements?.disabled_reason ?? null,
  };
}

/** Null when a withdrawal is allowed. payouts_enabled is the only withdrawal gate. */
export function withdrawalBlockedReason(state) {
  if (state?.payouts_enabled === true || state?.status === "verified") return null;
  if (state?.status === "needs_info" || (state?.currently_due?.length ?? 0) > 0) {
    return "Stripe still needs information before a payout can be sent.";
  }
  if (state?.status === "accepting" || state?.can_accept_charges === true) {
    return "Card payments are on, but Stripe is still reviewing bank payouts. Request Payout stays off until payouts are enabled.";
  }
  if (state?.details_submitted === true || state?.status === "review") {
    return "Stripe has the payout details and is still reviewing them. Withdrawals stay off until payouts are enabled.";
  }
  return "Set up payouts in Wallet before requesting a withdrawal.";
}
