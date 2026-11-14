import { isIosApp } from "@/lib/platform";

let lastPulse = 0;

/** Light tap on the Capacitor iOS app. Web and Android skip it. Failures are ignored. */
export function pulseXpHaptic(): void {
  const now = Date.now();
  if (now - lastPulse < 700) return;
  lastPulse = now;
  if (!isIosApp()) return;
  void import("@capacitor/haptics")
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
    .catch(() => undefined);
}
