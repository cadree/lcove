import { useSyncExternalStore } from "react";
import { getPlayerState, subscribePlayer } from "@/lib/musicPlayer";

export function useMusicPlayer() {
  return useSyncExternalStore(subscribePlayer, getPlayerState, getPlayerState);
}
