// Checks a locked-track checkout before any Stripe call. The client sends a track
// id and an optional access rule id; everything that decides who gets paid and
// how much comes from the database rows, never from the request.

/** Stripe's smallest USD charge. */
export const MIN_TRACK_PRICE_CENTS = 50;

export class MusicPurchaseError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "MusicPurchaseError";
    this.status = status;
  }
}

/**
 * @param {object} input
 * @param {{ id: string, artist_user_id: string, price_cents?: number|null, access_type?: string, is_published?: boolean }|null} input.track
 * @param {{ id: string, artist_user_id: string, track_id?: string|null, rule_type?: string, amount_cents?: number|null, is_active?: boolean }|null} input.rule
 * @param {string|null} input.requestedRuleId
 * @param {string} input.buyerId
 * @param {boolean} input.alreadyPaid  buyer already has a paid purchase of this track
 * @returns {{ artistUserId: string, amountCents: number, accessRuleId: string|null }}
 */
export function resolveMusicPurchase({ track, rule, requestedRuleId, buyerId, alreadyPaid }) {
  if (!track || track.is_published === false) throw new MusicPurchaseError("Track not found", 404);
  if (track.artist_user_id === buyerId) throw new MusicPurchaseError("You can't purchase your own track");
  if (alreadyPaid) throw new MusicPurchaseError("You already own this track. Refresh to play it.", 409);

  if (track.access_type === "free") throw new MusicPurchaseError("This track is free to listen to in Ether.");

  let amountCents = Number(track.price_cents) || 0;
  let accessRuleId = null;
  if (requestedRuleId) {
    const usable = rule
      && rule.id === requestedRuleId
      && rule.artist_user_id === track.artist_user_id
      && (rule.track_id == null || rule.track_id === track.id)
      && (rule.rule_type ?? "purchase") === "purchase"
      && rule.is_active !== false;
    if (!usable) throw new MusicPurchaseError("That price isn't available for this track anymore. Refresh and try again.");
    if (Number(rule.amount_cents) > 0) amountCents = Number(rule.amount_cents);
    accessRuleId = rule.id;
  }

  if (!Number.isInteger(amountCents) || amountCents < MIN_TRACK_PRICE_CENTS) {
    throw new MusicPurchaseError("This track doesn't have a price yet.");
  }
  return { artistUserId: track.artist_user_id, amountCents, accessRuleId };
}
