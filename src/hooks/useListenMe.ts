import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import type { Listener } from "@/lib/listenTogether";

/** How I appear to the other person in a Listen together session. */
export function useListenMe(): Listener | null {
  const { user } = useAuth();
  const { profile } = useProfile();
  return useMemo(
    () => (user ? { userId: user.id, name: profile?.display_name || "Someone", avatar: profile?.avatar_url ?? null } : null),
    [user, profile?.display_name, profile?.avatar_url],
  );
}
