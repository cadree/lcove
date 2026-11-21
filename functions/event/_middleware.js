import { onEventShareRequest } from "../_shared/eventShareRequest.js";

/** /event/:id only. A public event redirects to /e/:slug. Hidden events stay generic. */
export function onRequest(context) {
  return onEventShareRequest(context);
}
