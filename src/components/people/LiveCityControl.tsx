import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LocateFixed, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { discovery, type DiscoverySettings } from "@/lib/creativeDiscovery";
import { nearestCity, placeForKey } from "@/lib/peopleDiscovery";
import { suggestCities } from "@/lib/cities";

const DURATIONS = [
  { hours: 4, label: "4 hours" },
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
];

function devicePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error("Location is not available on this device."));
    else navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Location permission was not granted. Pick your city instead.")), {
      enableHighAccuracy: false,
      maximumAge: 10 * 60_000,
      timeout: 15_000,
    });
  });
}

/**
 * Opt-in live city. Only a city key leaves the device; coordinates are snapped to the
 * nearest known city here and then discarded. It expires on its own.
 */
export function LiveCityControl({ settings, disabled }: { settings: DiscoverySettings | undefined; disabled: boolean }) {
  const cache = useQueryClient();
  const [hours, setHours] = useState(24);
  const [typed, setTyped] = useState("");
  const live = placeForKey(settings?.live_city_key);
  const until = settings?.live_until ? new Date(settings.live_until) : null;
  const save = useMutation({
    mutationFn: ({ key, hours }: { key: string | null; hours: number | null }) => discovery.liveCity(key, hours),
    onSuccess: async (data) => {
      cache.setQueryData(["discovery-settings"], data);
      await cache.invalidateQueries({ queryKey: ["discovery-settings"] });
      await cache.invalidateQueries({ queryKey: ["discovery-globe"] });
      toast.success(data.live_city_key ? `Live in ${placeForKey(data.live_city_key)?.label}` : "Live city is off");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const shareDeviceCity = async () => {
    try {
      const position = await devicePosition();
      const coordinates = (await import("@/data/cityCoordinates.json")).default as Record<string, number[]>;
      const key = nearestCity(position.coords.latitude, position.coords.longitude, coordinates);
      if (!key) throw new Error("No city found near you. Pick your city instead.");
      save.mutate({ key, hours });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const suggestions = typed.trim().length >= 2 ? suggestCities(typed, 4) : [];
  return (
    <section className="space-y-3 rounded-2xl border border-border p-4" aria-label="Live city">
      <div className="flex items-start gap-3">
        <Radio className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--scan))]" />
        <div>
          <h3 className="font-semibold">Live city (optional)</h3>
          <p className="text-sm text-muted-foreground">
            Traveling? Show members which city you are in right now. Only the city is shared, never your exact location, and it turns off on its own.
          </p>
        </div>
      </div>
      {live && until && until > new Date() ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted p-3">
          <p className="text-sm">
            Live in <strong>{live.label}</strong> until {until.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}
          </p>
          <Button type="button" variant="outline" className="min-h-11" disabled={save.isPending} onClick={() => save.mutate({ key: null, hours: null })}>
            Turn off now
          </Button>
        </div>
      ) : (
        <>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Share for</span>
            <select className="h-11 rounded-xl border border-border bg-background px-3" value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Share live city for">
              {DURATIONS.map((d) => (
                <option key={d.hours} value={d.hours}>{d.label}</option>
              ))}
            </select>
          </label>
          <Button type="button" className="min-h-11 w-full gap-2" disabled={disabled || save.isPending} onClick={() => void shareDeviceCity()}>
            <LocateFixed className="h-4 w-4" /> Use my current city
          </Button>
          <div>
            <input
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              placeholder="Or type a city, e.g. Miami"
              aria-label="Live city"
              value={typed}
              disabled={disabled}
              onChange={(e) => setTyped(e.target.value)}
            />
            {suggestions.length > 0 && (
              <ul className="mt-1 overflow-hidden rounded-xl border border-border">
                {suggestions.map((city) => (
                  <li key={city.key}>
                    <button type="button" className="min-h-11 w-full px-3 text-left text-sm hover:bg-muted" onClick={() => { setTyped(""); save.mutate({ key: city.key, hours }); }}>
                      {city.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {disabled && <p className="text-xs text-muted-foreground">Turn on “Show me on the globe” to share a live city.</p>}
        </>
      )}
    </section>
  );
}
