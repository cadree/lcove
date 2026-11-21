// Card processing is separate from Ether's platform fee, which stays 0.
// US card estimate: 2.9% + 30¢. Keep this file in step with src/lib/ticketFees.ts.

export const CARD_PERCENT = 0.029;
export const CARD_FIXED_CENTS = 30;

export function ticketCents(value) {
  const cents = Math.round(Number(value) || 0);
  if (!Number.isFinite(cents) || cents < 0) return 0;
  return cents;
}

export function estimatedCardFeeCents(chargeCents) {
  const charge = ticketCents(chargeCents);
  if (charge === 0) return 0;
  return Math.round(charge * CARD_PERCENT) + CARD_FIXED_CENTS;
}

// Buyer total for one ticket. When the host does not absorb fees, the buyer
// pays enough that the host still nets the listed ticket price.
export function buyerUnitCents(priceCents, absorbFees) {
  const ticket = ticketCents(priceCents);
  if (ticket === 0) return 0;
  if (absorbFees) return ticket;
  return Math.ceil((ticket + CARD_FIXED_CENTS) / (1 - CARD_PERCENT));
}

export function shownFeeCents(priceCents, absorbFees) {
  const ticket = ticketCents(priceCents);
  if (ticket === 0) return 0;
  if (absorbFees) return estimatedCardFeeCents(ticket);
  return buyerUnitCents(ticket, false) - ticket;
}

export function hostNetCents(priceCents, absorbFees) {
  const ticket = ticketCents(priceCents);
  if (ticket === 0) return 0;
  if (!absorbFees) return ticket;
  return Math.max(0, ticket - estimatedCardFeeCents(ticket));
}

// Kept by the platform account to cover the card fee. This is not an Ether fee.
export function applicationFeeCents(priceCents, absorbFees) {
  const ticket = ticketCents(priceCents);
  if (ticket === 0) return 0;
  if (!absorbFees) return shownFeeCents(ticket, false);
  return Math.min(ticket, estimatedCardFeeCents(ticket));
}

export function formatUsd(cents) {
  return `$${(ticketCents(cents) / 100).toFixed(2)}`;
}

export function priceCheckout(lines, absorbFees) {
  const priced = [];
  let subtotal = 0;
  let total = 0;
  let fee = 0;
  let hostNet = 0;
  for (const line of lines) {
    const quantity = Math.max(0, Math.floor(Number(line.quantity) || 0));
    const price = ticketCents(line.priceCents);
    const unitBuyer = buyerUnitCents(price, absorbFees);
    const unitFee = applicationFeeCents(price, absorbFees);
    const unitNet = hostNetCents(price, absorbFees);
    subtotal += price * quantity;
    total += unitBuyer * quantity;
    fee += unitFee * quantity;
    hostNet += unitNet * quantity;
    priced.push({
      tierId: line.tierId,
      name: line.name,
      quantity,
      unitAmount: unitBuyer,
      description: line.description || "",
    });
  }
  return { subtotal, total, fee, hostNet, lines: priced };
}

export function tierPriceLabel(priceCents, absorbFees) {
  const ticket = ticketCents(priceCents);
  if (ticket === 0) return "Free";
  if (absorbFees) return formatUsd(ticket);
  const total = buyerUnitCents(ticket, false);
  return `${formatUsd(total)} incl. ${formatUsd(total - ticket)} fees`;
}
