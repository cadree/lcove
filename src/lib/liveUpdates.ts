import { Capacitor } from "@capacitor/core";

/**
 * Tell the native updater that this web bundle booted. Call this as soon as
 * JavaScript starts on every launch. If it is not called within
 * appReadyTimeout (10 seconds), the plugin reverts to the last good bundle.
 * Do not wait for network or data; a late call can roll back a good bundle.
 */
export async function notifyLiveUpdateReady(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
  await CapacitorUpdater.notifyAppReady();
}
