import { REQUEST_DEADLINE_MS } from "./feedWindow.ts";

/** Stops a request that never settles from leaving a spinner up. */
export function abortAfter(ms = REQUEST_DEADLINE_MS): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}
