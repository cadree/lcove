/** One coarse device fix. Callers snap it to a city or a ~1 km area right away and drop it. */
export function devicePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error("Location is not available on this device."));
    else navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Location permission was not granted. Pick your city instead.")), {
      enableHighAccuracy: false,
      maximumAge: 10 * 60_000,
      timeout: 15_000,
    });
  });
}
