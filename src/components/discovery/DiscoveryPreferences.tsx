import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { discovery } from "@/lib/creativeDiscovery";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function DiscoveryPreferences() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const settings = useQuery({
    queryKey: ["discovery-settings", user?.id],
    queryFn: () => discovery.settings(),
    enabled: !!user,
  });
  const save = useMutation({
    mutationFn: discovery.settings,
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["discovery-settings"] });
      await cache.invalidateQueries({ queryKey: ["discovery"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section
      className="file-panel space-y-4 p-5"
      aria-label="Discovery and message privacy"
    >
      <h2 className="ether-title text-xl">Discovery & private DMs</h2>
      {settings.isError ? (
        <p role="alert" className="text-sm">
          Discovery settings are unavailable.{" "}
          <button className="underline" onClick={() => settings.refetch()}>
            Retry
          </button>
        </p>
      ) : (
        <>
          <label className="flex items-center justify-between gap-4">
            <span>
              <strong className="block">Show me on the globe</strong>
              <span className="text-sm text-muted-foreground">
                Share your profile city, bio and public work with signed-in
                creatives. No live location.
              </span>
            </span>
            <Switch
              aria-label="Show me on the globe"
              disabled={!settings.data || save.isPending}
              checked={settings.data?.discoverable ?? false}
              onCheckedChange={(v) => save.mutate({ p_discoverable: v })}
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>
              <strong className="block">Matches-only DMs</strong>
              <span className="text-sm text-muted-foreground">
                Only mutual swipe matches can DM you, including in existing
                direct chats. Group chats you join remain available.
              </span>
            </span>
            <Switch
              aria-label="Matches-only DMs"
              disabled={!settings.data || save.isPending}
              checked={settings.data?.matches_only ?? false}
              onCheckedChange={(v) => save.mutate({ p_matches_only: v })}
            />
          </label>
        </>
      )}
      <Link
        to="/settings"
        className="inline-flex min-h-11 items-center text-sm underline"
      >
        Edit your profile city in Settings
      </Link>
    </section>
  );
}
