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
  const skip = shotSessionEnabled();
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const total = reduced ? REDUCED_MS : POWER_MS;

  useLayoutEffect(() => {
    // index.html paints this image before JavaScript. Drop it once React's splash is in the tree.
    document.getElementById("boot-splash")?.remove();
  }, []);

  useEffect(() => {
    void hideNativeSplash();
    if (skip) {
      setGone(true);
      return;
    }
    const timer = window.setTimeout(() => setGone(true), total);
    return () => window.clearTimeout(timer);
  }, [skip, total]);

  if (gone || skip) return null;

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
