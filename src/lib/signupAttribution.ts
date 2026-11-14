const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export const SIGNUP_ATTRIBUTION_KEY = "ether_signup_attribution";

export type SignupAttribution = {
  src?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  landing_path: string;
  captured_at: string;
};

type AttributionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function attributionFromSearch(
  search: string,
  path: string,
  capturedAt: string,
): SignupAttribution | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const record: Partial<SignupAttribution> = {};
  const src = params.get("src")?.trim();
  if (src) record.src = src.slice(0, 200);
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim();
    if (value) record[key] = value.slice(0, 200);
  }
  if (!record.src && !UTM_KEYS.some((key) => record[key])) return null;
  return {
    ...record,
    landing_path: path.slice(0, 200),
    captured_at: capturedAt,
  };
}

export function readStoredAttribution(storage: AttributionStorage): SignupAttribution | null {
  const raw = storage.getItem(SIGNUP_ATTRIBUTION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SignupAttribution;
    if (!parsed || typeof parsed.landing_path !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** First touch wins. Later visits do not replace a stored source. */
export function captureSignupAttribution(
  search: string,
  path: string,
  storage: AttributionStorage,
  capturedAt = new Date().toISOString(),
): SignupAttribution | null {
  const existing = readStoredAttribution(storage);
  if (existing) return existing;
  const fresh = attributionFromSearch(search, path, capturedAt);
  if (!fresh) return null;
  storage.setItem(SIGNUP_ATTRIBUTION_KEY, JSON.stringify(fresh));
  return fresh;
}
