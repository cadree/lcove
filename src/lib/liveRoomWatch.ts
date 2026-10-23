import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Refresh a live-room query. Polls until realtime is joined, then stops. */
export function watchRows(
  channelName: string,
  table: string,
  filter: string,
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  event: "INSERT" | "*" = "INSERT",
) {
  let poll: number | undefined;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey });
  };
  const changes = {
    event,
    schema: "public" as const,
    table,
    ...(filter ? { filter } : {}),
  };
  const channel = supabase.channel(channelName).on(
    "postgres_changes",
    changes as { event: "*"; schema: "public"; table: string; filter: string },
    refresh,
  )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (poll) window.clearInterval(poll);
        poll = undefined;
        return;
      }
      if (!poll) poll = window.setInterval(refresh, 2000);
    });
  return () => {
    if (poll) window.clearInterval(poll);
    void supabase.removeChannel(channel);
  };
}
