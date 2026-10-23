import { useEffect, useRef, useState } from "react";
import { pulseXpHaptic } from "@/lib/xpHaptic";

/**
 * Returns a token that increments when XP increases or a quest decrypts
 * after the first settled snapshot. The first load does not celebrate.
 */
export function useXpCelebrate(total: number, doneKey: string, ready: boolean): number {
  const prev = useRef<{ total: number; doneKey: string } | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (!ready) return;
    const last = prev.current;
    prev.current = { total, doneKey };
    if (!last) return;
    const previousIds = last.doneKey.split(",").filter(Boolean);
    const finished = doneKey.split(",").some((id) => id && !previousIds.includes(id));
    if (total > last.total || finished) {
      setToken((current) => current + 1);
      pulseXpHaptic();
    }
  }, [total, doneKey, ready]);

  return token;
}
