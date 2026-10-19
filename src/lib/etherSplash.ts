export const POWER_MS = 1600;
export const REDUCED_MS = 700;

export type SplashFrame = { logo: number; brightness: number; veil: number };

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Flicker, then the glow blooms. The first sample is the full logo, matching the native splash. */
export function splashFrame(t: number, reduced: boolean): SplashFrame {
  if (reduced) {
    if (t <= 180) return { logo: 1, brightness: 1, veil: 1 };
    const p = Math.min(1, (t - 180) / (REDUCED_MS - 180));
    return { logo: 1, brightness: 1, veil: 1 - p };
  }

  let logo = 1;
  let brightness = 1;
  if (t < 140) {
    logo = 1;
    brightness = 1;
  } else if (t < 620) {
    const keys: Array<[number, number, number]> = [
      [140, 1, 1],
      [210, 0.18, 0.45],
      [290, 0.94, 1.05],
      [370, 0.12, 0.35],
      [460, 0.78, 0.9],
      [540, 0.28, 0.55],
      [620, 0.4, 0.48],
    ];
    let i = 0;
    while (i < keys.length - 1 && t > keys[i + 1][0]) i += 1;
    const [t0, o0, b0] = keys[i];
    const [t1, o1, b1] = keys[Math.min(i + 1, keys.length - 1)];
    const p = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
    logo = mix(o0, o1, p);
    brightness = mix(b0, b1, p);
  } else if (t < 1360) {
    const p = (t - 620) / (1360 - 620);
    const s = p * p * (3 - 2 * p);
    logo = mix(0.4, 1, s);
    brightness = p < 0.72 ? mix(0.48, 1.35, p / 0.72) : mix(1.35, 1, (p - 0.72) / 0.28);
  }

  const veil = t < 1420 ? 1 : Math.max(0, 1 - (t - 1420) / (POWER_MS - 1420));
  return { logo, brightness, veil };
}
