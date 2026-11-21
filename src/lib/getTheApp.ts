import { isIosCapture, type CaptureSignals } from "./livePhone.ts";

export const GET_THE_APP_STORAGE_KEY = "ether:get-the-app-dismissed";

/** Routes that already have a required next step. The prompt waits until those finish. */
export const GET_THE_APP_HOLD_PATHS = new Set([
  "/onboarding",
  "/welcome",
  "/pending",
  "/denied",
  "/locked",
]);

export interface GetTheAppPromptInput {
  storeUrl: string;
  signedIn: boolean;
  native: boolean;
  iosWeb: boolean;
  dismissed: boolean;
  pathname: string;
}

export function isIosWebVisitor(input: CaptureSignals): boolean {
  return isIosCapture(input);
}

export function shouldShowGetTheAppPrompt(input: GetTheAppPromptInput): boolean {
  if (!input.storeUrl || input.native || !input.iosWeb || input.dismissed) return false;
  if (input.pathname === "/auth") return true;
  if (!input.signedIn) return false;
  return !GET_THE_APP_HOLD_PATHS.has(input.pathname);
}

type ReadableStore = Pick<Storage, "getItem">;
type WritableStore = Pick<Storage, "setItem">;

export function getTheAppDismissed(store: ReadableStore): boolean {
  try {
    return store.getItem(GET_THE_APP_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markGetTheAppDismissed(store: WritableStore): void {
  try {
    store.setItem(GET_THE_APP_STORAGE_KEY, "1");
  } catch {
    /* private mode: the prompt may show again next time */
  }
}
