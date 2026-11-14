/** StoreKit Storefront.countryCode is ISO 3166-1 alpha-3. The US storefront is USA. */
export const US_STOREFRONT_CODE = "USA";

export const EXTERNAL_CHECKOUT_HOSTS = [
  "etherbylcove.com",
  "www.etherbylcove.com",
  "checkout.stripe.com",
  "billing.stripe.com",
] as const;

export function isUsStorefront(countryCode: string | null | undefined): boolean {
  return (countryCode ?? "").trim().toUpperCase() === US_STOREFRONT_CODE;
}

const externalCheckoutHosts = new Set<string>(EXTERNAL_CHECKOUT_HOSTS);

export function externalCheckoutUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && externalCheckoutHosts.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Path inside the app after Safari returns from membership or fund checkout. */
export function checkoutReturnPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:") return null;
    if (host !== "etherbylcove.com" && host !== "www.etherbylcove.com") return null;
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    const allowed = path === "/membership" || path === "/fund" || path.startsWith("/membership/") || path.startsWith("/fund/");
    if (!allowed) return null;
    return `${path}${parsed.search}`;
  } catch {
    return null;
  }
}
