import { Capacitor } from "@capacitor/core";

/**
 * True only inside the Capacitor iOS app.
 * Web and Android keep Stripe checkout for digital goods.
 */
export function isIosApp(): boolean {
  return Capacitor.getPlatform() === "ios";
}

export const ETHER_WEB_ORIGIN = "https://etherbylcove.com";
