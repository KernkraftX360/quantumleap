import { haversineKm, type Coordinates } from "@/lib/geofence";

export type RouteEstimate = {
  distanceKm: number;
  travelMinutes: number;
  provider: "tomtom" | "osrm" | "estimate";
  trafficAware: boolean;
};

export async function getRouteEstimate(origin: Coordinates, destination: Coordinates): Promise<RouteEstimate> {
  const tomtomKey = process.env.TOMTOM_API_KEY;
  if (tomtomKey) {
    try {
      const route = `${origin.latitude},${origin.longitude}:${destination.latitude},${destination.longitude}`;
      const response = await fetch(
        `https://api.tomtom.com/routing/1/calculateRoute/${route}/json?traffic=true&travelMode=car&key=${encodeURIComponent(tomtomKey)}`,
        { signal: AbortSignal.timeout(4500), cache: "no-store" },
      );
      if (response.ok) {
        const body = await response.json();
        const summary = body.routes?.[0]?.summary;
        if (summary) {
          return {
            distanceKm: Math.round((summary.lengthInMeters / 1000) * 10) / 10,
            travelMinutes: Math.max(1, Math.ceil(summary.travelTimeInSeconds / 60)),
            provider: "tomtom",
            trafficAware: true,
          };
        }
      }
    } catch {
      // Continue to the keyless OSRM provider.
    }
  }

  try {
    const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`,
      { signal: AbortSignal.timeout(4500), cache: "no-store" },
    );
    if (response.ok) {
      const body = await response.json();
      const route = body.routes?.[0];
      if (route) {
        const hour = new Date().getHours();
        const commuteFactor = hour >= 7 && hour <= 9 ? 1.18 : hour >= 16 && hour <= 19 ? 1.22 : 1.08;
        return {
          distanceKm: Math.round((route.distance / 1000) * 10) / 10,
          travelMinutes: Math.max(1, Math.ceil((route.duration / 60) * commuteFactor)),
          provider: "osrm",
          trafficAware: false,
        };
      }
    }
  } catch {
    // Fall back to a conservative local road-speed estimate.
  }

  const distanceKm = haversineKm(origin, destination) * 1.25;
  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    travelMinutes: Math.max(1, Math.ceil((distanceKm / 28) * 60)),
    provider: "estimate",
    trafficAware: false,
  };
}
