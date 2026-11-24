import { useEffect, useState, useSyncExternalStore } from "react";
import { getListenState, subscribeListen, watchRoom } from "@/lib/listenRealtime";
import type { Listener } from "@/lib/listenTogether";

export function useListenState() {
  return useSyncExternalStore(subscribeListen, getListenState, () => null);
}

/** Who else is in a session right now (for the DM card), or nobody when signed out. */
export function useRoomListeners(session: string | null, me: string | null | undefined) {
  const [others, setOthers] = useState<Listener[]>([]);
  useEffect(() => {
    if (!session || !me) return;
    return watchRoom(session, me, setOthers);
  }, [session, me]);
  return others;
}
