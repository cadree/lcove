import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { createIosPushRegistration } from "@/lib/iosPushRegistration";

/**
 * Register this device for APNs when running inside the Capacitor iOS app.
 * Safe to call again after sign-in: the same user is not prompted twice, and
 * a denied permission or a failed registration is logged and does not throw.
 * The token is stored so a later sender can target it. Delivery itself needs
 * an APNs key from Cadre's Apple account; this function does not send pushes.
 */
const registration = createIosPushRegistration({
  getPlatform: () => Capacitor.getPlatform(),
  requestPermissions: () => PushNotifications.requestPermissions(),
  addRegistrationListener: async (handler) => {
    await PushNotifications.addListener("registration", (token) => {
      void handler(token);
    });
  },
  addRegistrationErrorListener: async (handler) => {
    await PushNotifications.addListener("registrationError", handler);
  },
  register: () => PushNotifications.register(),
  saveSubscription: async (row) => {
    const { error } = await supabase.from("push_subscriptions").upsert(row, {
      onConflict: "user_id,endpoint",
    });
    return error?.message ?? null;
  },
});

export async function registerIosPush(userId: string): Promise<void> {
  return registration.register(userId);
}
