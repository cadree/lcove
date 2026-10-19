import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { appPathFromIncomingUrl } from "@/lib/nativeLinks";

export type IosPushPermission = "granted" | "denied" | "prompt";

const OPT_OUT_KEY = "ether_ios_push_opt_out";

let registrationHandle: PluginListenerHandle | null = null;
let errorHandle: PluginListenerHandle | null = null;
let actionHandle: PluginListenerHandle | null = null;

function queuePath(path: string) {
  window.dispatchEvent(new CustomEvent("ether:navigate", { detail: path }));
}

function pathFromPushUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return appPathFromIncomingUrl(raw);
}

async function storeApnsToken(userId: string, token: string) {
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: `apns:${token}`,
      p256dh: "apns",
      auth: "apns",
      platform: "apns",
      user_agent: "capacitor-ios",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) console.error("Failed to store APNs token", error.message);
}

async function listenAndRegister(userId: string) {
  if (registrationHandle) {
    await registrationHandle.remove();
    registrationHandle = null;
  }
  if (errorHandle) {
    await errorHandle.remove();
    errorHandle = null;
  }
  if (!actionHandle) {
    actionHandle = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const path = pathFromPushUrl(action.notification.data?.url);
      if (path) queuePath(path);
    });
  }

  registrationHandle = await PushNotifications.addListener("registration", async (token) => {
    await storeApnsToken(userId, token.value);
  });
  errorHandle = await PushNotifications.addListener("registrationError", (err) => {
    console.error("APNs registration failed", err.error);
  });
  await PushNotifications.register();
}

function normalizePermission(receive: string): IosPushPermission {
  if (receive === "granted") return "granted";
  if (receive === "denied") return "denied";
  return "prompt";
}

async function optedOutOfPush(): Promise<boolean> {
  const { value } = await Preferences.get({ key: OPT_OUT_KEY });
  return value === "1";
}

/**
 * If iOS already granted notification permission, refresh the APNs token.
 * Does not show the system prompt. Skips registration after the user turns
 * push off in Settings, until they turn it on again.
 */
export async function syncIosPushIfGranted(userId: string): Promise<IosPushPermission> {
  if (Capacitor.getPlatform() !== "ios") return "denied";
  const current = await PushNotifications.checkPermissions();
  const permission = normalizePermission(current.receive);
  if (permission === "denied") return "denied";
  if (await optedOutOfPush()) return "prompt";
  if (permission !== "granted") return permission;
  await listenAndRegister(userId);
  return "granted";
}

/**
 * Ask for notification permission, then store the APNs device token.
 * Delivery still needs the owner's APNs key. This does not send a push.
 */
export async function registerIosPush(userId: string): Promise<IosPushPermission> {
  if (Capacitor.getPlatform() !== "ios") return "denied";
  await Preferences.remove({ key: OPT_OUT_KEY });
  const permission = await PushNotifications.requestPermissions();
  const normalized = normalizePermission(permission.receive);
  if (normalized !== "granted") return normalized;
  await listenAndRegister(userId);
  return "granted";
}

export async function unregisterIosPush(userId: string): Promise<void> {
  if (Capacitor.getPlatform() !== "ios") return;
  await Preferences.set({ key: OPT_OUT_KEY, value: "1" });
  await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("platform", "apns");
}
