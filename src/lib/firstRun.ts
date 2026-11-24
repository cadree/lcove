/** After human approval, the member first registers their ETHER Card. */
export const FIRST_RUN_PATH = "/welcome";
/** ETHER Card setup exits to the people deck. */
export const AFTER_WELCOME_PATH = "/explore?section=people&welcome=1";

export type WelcomeStatus = { needs_setup: boolean; card_registered: boolean };

/** What the app does with an approved member's welcome state on a page load. */
export type WelcomeStep =
  | { kind: "none" }
  /** No card yet: send them to the one welcome screen. */
  | { kind: "redirect"; to: typeof FIRST_RUN_PATH }
  /** Card is registered but the last tap never landed: finish it, never redirect. */
  | { kind: "finish" };

const isSetupScreen = (pathname: string, search: string) =>
  pathname === FIRST_RUN_PATH ||
  (pathname === "/id" && new URLSearchParams(search).get("setup") === "1");

/**
 * A registered card always releases the member. Only someone without a card is
 * sent to /welcome, and never from the welcome or card setup screens, so the
 * gate cannot bounce between them.
 */
export function welcomeStep(status: WelcomeStatus | null | undefined, pathname: string, search: string): WelcomeStep {
  if (!status?.needs_setup) return { kind: "none" };
  if (status.card_registered) return { kind: "finish" };
  if (isSetupScreen(pathname, search)) return { kind: "none" };
  return { kind: "redirect", to: FIRST_RUN_PATH };
}

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
