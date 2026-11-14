import { onEventShareRequest } from "../_shared/eventShareRequest.js";

/** /e/:slug only. Landing, feed, and other routes never enter this function. */
export function onRequest(context) {
  return onEventShareRequest(context);
}
