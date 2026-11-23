import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { registerIosPush } from "@/lib/nativePush";
import { isIosApp } from "@/lib/platform";

/**
 * Native iOS push. The system permission prompt shows once, right after the
 * member finishes onboarding, with no pre-screen. Before that, and after a
 * denial, nothing is asked: a granted device just refreshes its APNs token.
 * Web and Android do not prompt.
 */
export function NativeIosPush() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { profile } = useProfile();
  const onboarded = Boolean(profile?.onboarding_completed);

  useEffect(() => {
    if (!userId || !isIosApp()) return;
    void registerIosPush(userId, { prompt: onboarded });
  }, [userId, onboarded]);

  return null;
}
