// Calls the fetch-artist-image edge function for a pasted Spotify / Apple Music link.
// - One request per URL at a time: paste fires both onPaste and onChange, and the old
//   dialog sent two identical requests that raced each other.
// - One retry after a short pause when the call errors (cold start, dropped mobile
//   connection), then a plain "fill it in yourself" result instead of a hang.

export interface ArtistExtractResult {
  image_url?: string | null;
  artist_name?: string | null;
  genres?: string[];
  top_tracks?: Array<Record<string, unknown> & { name: string }>;
  albums?: Array<Record<string, unknown> & { name: string }>;
}

export interface ExtractOutcome {
  ok: boolean;
  data?: ArtistExtractResult;
  reason?: "error" | "empty";
}

export type InvokeFn = (url: string) => Promise<{ data: unknown; error: unknown }>;

export interface ExtractorOptions {
  retryDelayMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function hasContent(data: ArtistExtractResult | null | undefined): data is ArtistExtractResult {
  if (!data || typeof data !== "object") return false;
  return Boolean(
    data.artist_name ||
    data.image_url ||
    (Array.isArray(data.top_tracks) && data.top_tracks.length) ||
    (Array.isArray(data.albums) && data.albums.length) ||
    (Array.isArray(data.genres) && data.genres.length),
  );
}

export function createArtistExtractor(invoke: InvokeFn, options: ExtractorOptions = {}) {
  const retryDelayMs = options.retryDelayMs ?? 900;
  const timeoutMs = options.timeoutMs ?? 12000;
  const sleep = options.sleep ?? defaultSleep;
  const inFlight = new Map<string, Promise<ExtractOutcome>>();

  async function attempt(url: string): Promise<{ data: ArtistExtractResult | null; failed: boolean }> {
    try {
      const { data, error } = await withTimeout(invoke(url), timeoutMs);
      if (error) return { data: null, failed: true };
      const body = data as (ArtistExtractResult & { error?: string }) | null;
      if (body && typeof body === "object" && "error" in body && body.error) return { data: null, failed: true };
      return { data: body, failed: false };
    } catch {
      return { data: null, failed: true };
    }
  }

  async function run(url: string): Promise<ExtractOutcome> {
    let result = await attempt(url);
    if (result.failed) {
      await sleep(retryDelayMs);
      result = await attempt(url);
    }
    if (result.failed) return { ok: false, reason: "error" };
    if (!hasContent(result.data)) return { ok: false, reason: "empty" };
    return { ok: true, data: result.data };
  }

  return function extract(url: string): Promise<ExtractOutcome> {
    const existing = inFlight.get(url);
    if (existing) return existing;
    const promise = run(url).finally(() => inFlight.delete(url));
    inFlight.set(url, promise);
    return promise;
  };
}
