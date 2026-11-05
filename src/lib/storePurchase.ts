/** Rentals are real-world spaces. Other listings require explicit classification on iOS. */
export function storePurchaseAllowed(item: { type: string; is_digital?: boolean | null }, digitalAllowed: boolean): boolean {
  return digitalAllowed || (item.is_digital !== true && (item.type === 'rental' || item.is_digital === false));
}
