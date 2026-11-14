/** First run: onboarding ends on the people deck with a single, dismissible Connect hint. */
export const FIRST_RUN_PATH = "/explore?section=people&welcome=1";

const key = (userId: string) => `ether:first-connect-hint:${userId}`;

type Store = Pick<Storage, "getItem" | "setItem">;

/** Shown once per member, and only when they arrive from onboarding. */
export function showConnectHint(store: Store, userId: string | undefined, search: string): boolean {
  if (!userId) return false;
  if (new URLSearchParams(search).get("welcome") !== "1") return false;
  try {
    return store.getItem(key(userId)) !== "seen";
  } catch {
    return false;
  }
}

export function markConnectHintSeen(store: Store, userId: string | undefined): void {
  if (!userId) return;
  try {
    store.setItem(key(userId), "seen");
  } catch {
    /* private mode: the hint just shows again next time */
  }
}
