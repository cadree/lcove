import { Capacitor } from "@capacitor/core";

/**
 * True only inside the Capacitor iOS app.
 * Web and Android keep Stripe checkout for digital goods.
 */
export function isIosApp(): boolean {
  return Capacitor.getPlatform() === "ios";
}

/**
 * Card donations stay off in the iOS app. The build is free and has no in-app purchases.
 * Web and Android ignore this flag.
 */
export const IOS_DONATIONS_ENABLED = false;

/**
 * Digital-content checkout in the native iOS app.
 * Off for App Store review. Web and Android ignore this and keep Stripe.
 */
export const IOS_DIGITAL_PURCHASES_ENABLED = false;

/** Web and Android always allow digital checkout. iOS follows IOS_DIGITAL_PURCHASES_ENABLED. */
export function digitalPurchasesAllowed(iosApp: boolean, enabled = IOS_DIGITAL_PURCHASES_ENABLED): boolean {
  if (!iosApp) return true;
  return enabled;
}

export function digitalPurchasesEnabled(): boolean {
  return digitalPurchasesAllowed(isIosApp());
}

export const ETHER_WEB_ORIGIN = "https://etherbylcove.com";
