export const PAYOUT_UPGRADE_MESSAGE =
  "Payouts use Stripe Connect. Open Wallet and finish payout setup. Ether does not store bank details.";

export class PayoutRefusal extends Error {
  constructor(message) {
    super(message);
    this.name = "PayoutRefusal";
  }
}

/**
 * Live Wallet sends `{ amount, payout_method_id }` and omits `use_credits`.
 * That call must keep working when this function deploys first: route it
 * through Connect and answer refusals with HTTP 200 so the client can show
 * the message. A request with neither shape gets the upgrade message.
 */
export function interpretPayoutRequest(body) {
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, status: 200, error: "Invalid amount" };
  }
  const legacy = typeof body?.payout_method_id === "string" && body.payout_method_id.trim().length > 0;
  const useCredits = body?.use_credits === true;
  if (!useCredits && !legacy) {
    return { ok: false, status: 200, error: PAYOUT_UPGRADE_MESSAGE };
  }
  return {
    ok: true,
    amount,
    project_id: body?.project_id ?? null,
    role_id: body?.role_id ?? null,
    legacy: legacy && !useCredits,
  };
}
