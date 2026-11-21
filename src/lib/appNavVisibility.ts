export function visibleMoreItems<T extends { iosHidden?: boolean }>(items: T[], iosApp: boolean): T[] {
  return items.filter((item) => !(iosApp && item.iosHidden));
}

/** Membership stays hidden on iOS unless the App Store storefront is USA. */
export function visibleMoreItemsForStorefront<T extends { id: string; iosHidden?: boolean }>(
  items: T[],
  iosApp: boolean,
  usStorefront: boolean,
): T[] {
  return items.filter((item) => {
    if (!iosApp || !item.iosHidden) return true;
    return usStorefront && item.id === "membership";
  });
}
