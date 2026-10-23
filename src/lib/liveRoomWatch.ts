import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Refresh a live-room query.
 *
 * The poll used to wait for the realtime subscribe callback. That callback
 * does not run until the channel joins or hits Supabase's 10s join timeout,
 * and the interval then waits another tick before the first refresh. On the
 * host, chat is one of several channels, so a viewer message sat for about
 * 11s. The viewer's own channel settled sooner, which is why the other
 * direction was about 2s. Polling starts immediately. Chat keeps polling
 * after the join so a channel that reports SUBSCRIBED but drops the insert
 * still lands within the interval.
 */
export function watchRows(
  channelName: string,
  table: string,
  filter: string,
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  event: "INSERT" | "*" = "INSERT",
  options?: { intervalMs?: number; keepPolling?: boolean },
) {
  const intervalMs = options?.intervalMs ?? 2000;
  let poll: number | undefined;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey });
  };
  const startPoll = () => {
    if (!poll) poll = window.setInterval(refresh, intervalMs);
  };
  const changes = {
    event,
    schema: "public" as const,
    table,
    ...(filter ? { filter } : {}),
  };
  startPoll();
  const channel = supabase.channel(channelName).on(
    "postgres_changes",
    changes as { event: "*"; schema: "public"; table: string; filter: string },
    refresh,
  )
    .subscribe((status) => {
      if (status === "SUBSCRIBED" && !options?.keepPolling) {
        if (poll) window.clearInterval(poll);
        poll = undefined;
        return;
      }
      startPoll();
    });
  return () => {
    if (poll) window.clearInterval(poll);
    void supabase.removeChannel(channel);
  };
}
