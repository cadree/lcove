/** One-time ETHER Card intro after a member registers their card. */

export const CARD_INTRO_TITLE = "Your ETHER Card";

export const CARD_INTRO_POINTS = [
  {
    heading: "Community perks",
    body: "As the community grows, Ether partners with studios and businesses for member benefits like discounts and special privileges.",
  },
  {
    heading: "Who you are, fast",
    body: "People scan your card to see your reviews, projects you've worked on, events you've hosted and your portfolio in Ether. Quick credibility and trust when networking.",
  },
  {
    heading: "It grows with the community",
    body: "More partners, more benefits over time.",
  },
] as const;

export const CARD_INTRO_WALLET_LINE = "Add it to your Wallet so it's always on you.";
export const CARD_INTRO_KEEP_HANDY_LINE = "Keep it handy. Your card is here whenever you need it.";
export const CARD_INTRO_GOT_IT = "Got it";
export const CARD_INTRO_ADD_WALLET = "Add to Apple Wallet";
export const CARD_INTRO_VIEW_CARD = "View your card";
export const CARD_INTRO_ABOUT = "About your card";

/** Keep in sync with the CSS animation duration on .ether-id-spin.is-revealing. */
export const CARD_INTRO_REVEAL_MS = 1200;

const key = (userId: string) => `ether:card-intro:${userId}`;

type Store = Pick<Storage, "getItem" | "setItem">;

export function hasSeenCardIntro(store: Store, userId: string | undefined): boolean {
  if (!userId) return false;
  try {
    return store.getItem(key(userId)) === "seen";
  } catch {
    return false;
  }
}

/** Auto-show only after card registration during setup, once per member on this device. */
export function shouldAutoShowCardIntro(
  store: Store,
  input: { userId?: string; setupMode: boolean; cardRegistered: boolean },
): boolean {
  if (!input.setupMode || !input.cardRegistered || !input.userId) return false;
  return !hasSeenCardIntro(store, input.userId);
}

export function markCardIntroSeen(store: Store, userId: string | undefined): void {
  if (!userId) return;
  try {
    store.setItem(key(userId), "seen");
  } catch {
    /* private mode: the intro just shows again next time */
  }
}

export function cardIntroAction(walletVisible: boolean): "wallet" | "keep-handy" {
  return walletVisible ? "wallet" : "keep-handy";
}
