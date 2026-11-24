import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { AREA_UNAVAILABLE, discovery, type DiscoverySettings } from "@/lib/creativeDiscovery";
import { coarsen, type LonLat } from "@/lib/nearbyMap";
import { nearestCity } from "@/lib/peopleDiscovery";
import { devicePosition } from "@/lib/devicePosition";

const HOURS = 24;

/**
 * Opt-in "use my live location" for Nearby. The device position is snapped to the ~1 km grid on
 * the phone straight away; only that area and its nearest city key are sent, and both turn off
 * on their own after a day, when you hide yourself, or when you switch this off.
 */
export function LiveAreaToggle({
  on,
  disabled,
  onArea,
}: {
  on: boolean;
  disabled: boolean;
  onArea: (area: LonLat | null) => void;
}) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const refresh = async (data?: DiscoverySettings) => {
    if (data) cache.setQueryData(["discovery-settings"], data);
    await cache.invalidateQueries({ queryKey: ["discovery-settings"] });
    await cache.invalidateQueries({ queryKey: ["discovery-globe"] });
  };
  const turnOn = async () => {
    const position = await devicePosition();
    const area = coarsen(position.coords.latitude, position.coords.longitude);
    if (!area) throw new Error("Your location could not be read. Pick your city instead.");
    const coordinates = (await import("@/data/cityCoordinates.json")).default as Record<string, number[]>;
    const key = nearestCity(area[1], area[0], coordinates);
    if (!key) throw new Error("No city found near you. Pick your city in Discovery settings instead.");
    try {
      await refresh(await discovery.liveArea(key, area[0], area[1], HOURS));
      toast.success("Nearby uses your live area for the next 24 hours");
    } catch (e) {
      if ((e as Error).message !== AREA_UNAVAILABLE) throw e;
      // Older server: share the city only. The area stays on this phone to centre your map.
      await refresh(await discovery.liveCity(key, HOURS));
      toast.success("Sharing your live city for 24 hours. Members see the city only.");
    }
    onArea(area);
  };
  const turnOff = async () => {
    await refresh(await discovery.liveCity(null, null));
    onArea(null);
    toast.success("Live location is off");
  };
  return (
    <label className="mt-3 flex items-start justify-between gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      <span className="flex min-w-0 items-start gap-2.5">
        <LocateFixed size={18} className="mt-0.5 shrink-0 text-[#79c3cf]" aria-hidden />
        <span className="min-w-0">
          <strong className="block text-sm">Use my live location</strong>
          <span className="block text-xs leading-relaxed text-white/60">
            {disabled
              ? "Turn on “Show me on the globe” in Discovery settings first."
              : "More accurate Nearby. Members see the ~1 km area you’re in, never your exact spot. Turns off on its own after a day."}
          </span>
        </span>
      </span>
      <Switch
        aria-label="Use my live location"
        checked={on}
        disabled={disabled || busy}
        onCheckedChange={(next) => {
          setBusy(true);
          (next ? turnOn() : turnOff())
            .catch((e: Error) => toast.error(e.message))
            .finally(() => setBusy(false));
        }}
      />
    </label>
  );
}
