import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { discovery } from "@/lib/creativeDiscovery";
import { useAuth } from "@/contexts/AuthContext";
import { LiveCityControl } from "@/components/people/LiveCityControl";
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
      await cache.invalidateQueries({ queryKey: ["discovery-globe"] });
      await cache.invalidateQueries({ queryKey: ["discovery"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const visible = settings.data?.discoverable ?? true;
  return (
    <section className="space-y-4" aria-label="Discovery and message privacy">
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
                On by default. Members see you at your profile city and in the swipe deck. Turn off to hide; you stay in the member list.
              </span>
            </span>
            <Switch
              aria-label="Show me on the globe"
              disabled={!settings.data || save.isPending}
              checked={visible}
              onCheckedChange={(v) => save.mutate({ p_discoverable: v })}
            />
          </label>
          <LiveCityControl settings={settings.data} disabled={!settings.data || !visible} />
          <label className="flex items-center justify-between gap-4">
            <span>
              <strong className="block">Matches-only DMs</strong>
              <span className="text-sm text-muted-foreground">
                Only mutual matches can DM you, including in existing direct chats. Group chats you join remain available.
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
      <Link to="/settings" className="inline-flex min-h-11 items-center text-sm underline">
        Edit your profile city in Settings
      </Link>
    </section>
  );
}
