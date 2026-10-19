import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

/**
 * Register this device for APNs when running inside the Capacitor iOS app.
 * The token is stored so a later sender can target it. Delivery itself needs
 * an APNs key from Cadre's Apple account; this function does not send pushes.
 */
export async function registerIosPush(userId: string): Promise<void> {
  if (Capacitor.getPlatform() !== "ios") return;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return;

  await PushNotifications.addListener("registration", async (token) => {
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: `apns:${token.value}`,
        p256dh: "apns",
        auth: "apns",
        platform: "apns",
        user_agent: "capacitor-ios",
      },
      { onConflict: "user_id,endpoint" },
    );
    if (error) console.error("Failed to store APNs token", error.message);
  });

  await PushNotifications.addListener("registrationError", (err) => {
    console.error("APNs registration failed", err.error);
  });

  await PushNotifications.register();
}
