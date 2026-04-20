import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Touches the user's last_active_at timestamp once per session resume.
 * Used by the audience-targeting "active in last 30 days" filter.
 */
export function useTrackActivity() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    // Throttle: only call once per 6 hours per session
    const key = `lc_last_active_touch_${user.id}`;
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < 6 * 60 * 60 * 1000) return;
    localStorage.setItem(key, String(Date.now()));
    supabase.rpc("touch_last_active").then(() => {});
  }, [user?.id]);
}
