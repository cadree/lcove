// Keep equal to supabase/functions/_shared/ticket-fees.mjs.
// Ether's platform fee on tickets is 0. The amounts here are card processing only.

export const CARD_PERCENT = 0.029;
export const CARD_FIXED_CENTS = 30;

export function ticketCents(value: number): number {
  const cents = Math.round(Number(value) || 0);
  if (!Number.isFinite(cents) || cents < 0) return 0;
  return cents;
}

export function estimatedCardFeeCents(chargeCents: number): number {
  const charge = ticketCents(chargeCents);
  if (charge === 0) return 0;
  return Math.round(charge * CARD_PERCENT) + CARD_FIXED_CENTS;
}

export function buyerUnitCents(priceCents: number, absorbFees: boolean): number {
  const ticket = ticketCents(priceCents);
  if (ticket === 0) return 0;
  if (absorbFees) return ticket;
  return Math.ceil((ticket + CARD_FIXED_CENTS) / (1 - CARD_PERCENT));
}

export function shownFeeCents(priceCents: number, absorbFees: boolean): number {
  const ticket = ticketCents(priceCents);
  if (ticket === 0) return 0;
  if (absorbFees) return estimatedCardFeeCents(ticket);
  return buyerUnitCents(ticket, false) - ticket;
}

export function hostNetCents(priceCents: number, absorbFees: boolean): number {
  const ticket = ticketCents(priceCents);
  if (ticket === 0) return 0;
  if (!absorbFees) return ticket;
  return Math.max(0, ticket - estimatedCardFeeCents(ticket));
}

export function applicationFeeCents(priceCents: number, absorbFees: boolean): number {
  const ticket = ticketCents(priceCents);
  if (ticket === 0) return 0;
  if (!absorbFees) return shownFeeCents(ticket, false);
  return Math.min(ticket, estimatedCardFeeCents(ticket));
}

export function formatUsd(cents: number): string {
  return `$${(ticketCents(cents) / 100).toFixed(2)}`;
}

export function priceCheckout(
  lines: { tierId?: string; name?: string; priceCents: number; quantity: number; description?: string }[],
  absorbFees: boolean,
) {
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

export function tierPriceLabel(priceCents: number, absorbFees: boolean): string {
  const ticket = ticketCents(priceCents);
  if (ticket === 0) return "Free";
  if (absorbFees) return formatUsd(ticket);
  const total = buyerUnitCents(ticket, false);
  return `${formatUsd(total)} incl. ${formatUsd(total - ticket)} fees`;
}

export function lowestBuyerCents(
  tiers: { price_cents: number; is_active?: boolean; quantity_sold?: number; capacity?: number | null }[],
  absorbFees: boolean,
): number | null {
  const open = tiers.filter((tier) => {
    if (tier.is_active === false) return false;
    if (tier.capacity == null) return true;
    return tier.capacity - (tier.quantity_sold || 0) > 0;
  });
  if (open.length === 0) return null;
  return Math.min(...open.map((tier) => buyerUnitCents(tier.price_cents, absorbFees)));
}
