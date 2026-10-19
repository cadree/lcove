import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { EtherWordmark } from "@/components/brand/EtherWordmark";
import { POWER_MS, REDUCED_MS, splashFrame, type SplashFrame } from "@/lib/etherSplash";
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
  const [frame, setFrame] = useState<SplashFrame>({ logo: 1, brightness: 1, veil: 1 });
  const [gone, setGone] = useState(false);
  const skip = shotSessionEnabled();

  useEffect(() => {
    void hideNativeSplash();
    if (skip) {
      setGone(true);
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = reduced ? REDUCED_MS : POWER_MS;
    let start = 0;
    let raf = 0;
    let alive = true;

    const tick = (now: number) => {
      if (!alive) return;
      if (!start) start = now;
      const t = now - start;
      setFrame(splashFrame(Math.min(t, total), reduced));
      if (t >= total) {
        setGone(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [skip]);

  if (gone || skip) return null;

  return (
    <div
      className="ether-splash"
      style={{ opacity: frame.veil }}
      role="img"
      aria-label="Ether"
    >
      <EtherWordmark
        plain
        alt=""
        className="w-[min(86vw,26rem)]"
        style={{ opacity: frame.logo, filter: `brightness(${frame.brightness})` }}
      />
    </div>
  );
}
