import { useEffect, useState } from "react";
import { readStorefrontCountry } from "@/lib/externalCheckout";
import { isUsStorefront } from "@/lib/iosStorefront";
import { isIosApp } from "@/lib/platform";

/**
 * linkOut is true only after StoreKit reports the USA storefront.
 * Loading, a missing storefront, and every other country stay false.
 */
export function useIosExternalCheckout() {
  const ios = isIosApp();
  const [country, setCountry] = useState<string | null>(null);
  const [ready, setReady] = useState(!ios);

  useEffect(() => {
    if (!ios) return;
    let cancelled = false;
    void readStorefrontCountry().then((code) => {
      if (cancelled) return;
      setCountry(code);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ios]);

  return {
    ios,
    ready,
    country,
    linkOut: ios && ready && isUsStorefront(country),
  };
}
