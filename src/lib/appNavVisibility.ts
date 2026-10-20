export function visibleMoreItems<T extends { iosHidden?: boolean }>(items: T[], iosApp: boolean): T[] {
  return items.filter((item) => !(iosApp && item.iosHidden));
}
