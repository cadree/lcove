import { useEffect, useLayoutEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import wordmark from "@/assets/ether-wordmark-splash.webp";
import { POWER_MS, REDUCED_MS } from "@/lib/etherSplash";
import { shotSessionEnabled } from "@/lib/shotSession";

async function hideNativeSplash() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SplashScreen.hide({ fadeOutDuration: 0 });
  } catch {
    // Web and tests have no native splash to dismiss.
  }
}

export function EtherSplash() {
  const [gone, setGone] = useState(false);
  const [hasBoot, setHasBoot] = useState(false);
  const skip = shotSessionEnabled();
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const total = reduced ? REDUCED_MS : POWER_MS;

  useLayoutEffect(() => {
    const boot = document.getElementById("boot-splash");
    if (!boot) return;
    setHasBoot(true);
    if (skip) {
      boot.remove();
      return;
    }
    // One image, painted from HTML. A second copy here was covering it and
    // moving the LCP to after JavaScript.
    boot.classList.add("ether-splash");
    if (reduced) boot.classList.add("is-reduced");
    boot.style.animationDuration = `${total}ms`;
    const img = boot.querySelector("img");
    img?.classList.add("ether-splash-mark");
    if (img) img.style.animationDuration = `${total}ms`;
  }, [reduced, skip, total]);

  useEffect(() => {
    void hideNativeSplash();
    if (skip) {
      setGone(true);
      return;
    }
    const timer = window.setTimeout(() => {
      document.getElementById("boot-splash")?.remove();
      setGone(true);
    }, total);
    return () => window.clearTimeout(timer);
  }, [skip, total]);

  if (hasBoot || gone || skip) return null;

  return (
    <div
      className={reduced ? "ether-splash is-reduced" : "ether-splash"}
      style={{ animationDuration: `${total}ms` }}
      aria-hidden="true"
    >
      <img
        src={wordmark}
        alt=""
        width={840}
        height={269}
        fetchPriority="high"
        decoding="async"
        className="ether-splash-mark block h-auto w-[min(86vw,26rem)] max-w-full object-contain"
        style={{ animationDuration: `${total}ms` }}
      />
    </div>
  );
}
