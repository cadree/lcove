import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { registerIosPush } from "@/lib/nativePush";
import { isIosApp } from "@/lib/platform";

/**
 * Asks for the APNs token once the native iOS app has a signed-in session.
 * Settings does not have to be opened. Web and Android do not prompt.
 */
export function NativeIosPush() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId || !isIosApp()) return;
    void registerIosPush(userId);
  }, [userId]);

  return null;
}
