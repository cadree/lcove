import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { syncIosPushIfGranted } from "@/lib/nativePush";

/** Refresh a previously granted APNs token after sign-in. Does not prompt. */
export function IosPushRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    syncIosPushIfGranted(user.id).catch((error) => {
      console.error("iOS push sync failed", error);
    });
  }, [user?.id]);

  return null;
}
