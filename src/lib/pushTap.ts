import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { createPushTapQueue, pushTapPath } from "./pushTapRoute.mjs";

export const pushTapQueue = createPushTapQueue();
let started = false;

/**
 * Listen for notification taps in the iOS app. Call once at startup, before
 * React renders. Capacitor keeps a cold-start tap until a listener is added,
 * and the queue keeps it until the router attaches (PushTapNavigator).
 */
export function startPushTapListener(): void {
  if (started || Capacitor.getPlatform() !== "ios") return;
  started = true;
  void PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    pushTapQueue.deliver(pushTapPath(action?.notification?.data));
  }).catch((error) => console.error("Push tap listener failed", error));
}
