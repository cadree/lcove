import { Capacitor } from "@capacitor/core";

/**
 * True only inside the Capacitor iOS app.
 * Web and Android keep Stripe checkout for digital goods.
 */
export function isIosApp(): boolean {
  return Capacitor.getPlatform() === "ios";
}

/**
 * Card donations stay visible in the iOS app.
 * Set this to false if App Review rejects them. Membership and music stay hidden either way.
 */
export const IOS_DONATIONS_ENABLED = true;

export const ETHER_WEB_ORIGIN = "https://etherbylcove.com";
