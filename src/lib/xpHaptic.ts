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

/** Light tap on a one-sided connect, a slightly stronger one on a mutual match. Web skips it. */
export function pulseConnectHaptic(kind: "connect" | "match"): void {
  if (!isIosApp()) return;
  void import("@capacitor/haptics")
    .then(({ Haptics, ImpactStyle }) =>
      Haptics.impact({ style: kind === "match" ? ImpactStyle.Medium : ImpactStyle.Light }),
    )
    .catch(() => undefined);
}
