import { registerPlugin } from "@capacitor/core";
import { externalCheckoutUrlAllowed } from "@/lib/iosStorefront";
import { isIosApp } from "@/lib/platform";

interface EtherStorefrontPlugin {
  getCountryCode(): Promise<{ countryCode?: string }>;
  openExternal(options: { url: string }): Promise<void>;
}

const EtherStorefront = registerPlugin<EtherStorefrontPlugin>("EtherStorefront");

/** Null when the app is not iOS, the plugin fails, or StoreKit has no storefront. */
export async function readStorefrontCountry(): Promise<string | null> {
  if (!isIosApp()) return null;
  try {
    const result = await EtherStorefront.getCountryCode();
    const code = result.countryCode?.trim() ?? "";
    return code ? code : null;
  } catch {
    return null;
  }
}

/** Opens Safari. Refuses every other host so the WebView cannot navigate to checkout. */
export async function openExternalCheckout(url: string): Promise<void> {
  if (!externalCheckoutUrlAllowed(url)) {
    throw new Error("Checkout link isn't allowed.");
  }
  await EtherStorefront.openExternal({ url });
}

/** Opens an https URL in Safari through the same native bridge as checkout. */
export async function openInSafari(url: string): Promise<void> {
  await EtherStorefront.openExternal({ url });
}
