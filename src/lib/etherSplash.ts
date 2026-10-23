export const POWER_MS = 880;
export const REDUCED_MS = 320;

export type SplashFrame = { logo: number; brightness: number; veil: number };

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** One short flicker, then the veil lifts. A warm load stays under a second and a half. */
export function splashFrame(t: number, reduced: boolean): SplashFrame {
  if (reduced) {
    if (t <= 70) return { logo: 1, brightness: 1, veil: 1 };
    const p = Math.min(1, (t - 70) / (REDUCED_MS - 70));
    return { logo: 1, brightness: 1, veil: 1 - p };
  }

  let logo = 1;
  let brightness = 1;
  if (t < 80) {
    logo = 1;
    brightness = 1;
  } else if (t < 280) {
    const p = (t - 80) / (280 - 80);
    logo = p < 0.5 ? mix(1, 0.16, p / 0.5) : mix(0.16, 1, (p - 0.5) / 0.5);
    brightness = p < 0.5 ? mix(1, 0.4, p / 0.5) : mix(0.4, 1.12, (p - 0.5) / 0.5);
  } else if (t < 640) {
    const p = (t - 280) / (640 - 280);
    logo = 1;
    brightness = p < 0.55 ? mix(1.12, 1.28, p / 0.55) : mix(1.28, 1, (p - 0.55) / 0.45);
  }

  const veil = t < 640 ? 1 : Math.max(0, 1 - (t - 640) / (POWER_MS - 640));
  return { logo, brightness, veil };
}
