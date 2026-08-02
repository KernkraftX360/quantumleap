import { hasValidCoordinates, type Coordinates } from "@/lib/geofence";
import { normalizeMalaysiaState, type MalaysiaState } from "@/lib/malaysia-states";

type CachedState = { state: MalaysiaState | null; expiresAt: number };
const cache = new Map<string, CachedState>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function cacheKey(coords: Coordinates) {
  return `${coords.latitude.toFixed(3)},${coords.longitude.toFixed(3)}`;
}

export async function reverseGeocodeMalaysiaState(coords: Coordinates): Promise<MalaysiaState | null> {
  if (!hasValidCoordinates(coords)) return null;

  const key = cacheKey(coords);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.state;

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(coords.latitude));
  url.searchParams.set("lon", String(coords.longitude));
  url.searchParams.set("zoom", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("layer", "address");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "QuantumLeapQueue/1.0 (admin@quantumleap.app)",
      "Accept-Language": "en",
    },
    signal: AbortSignal.timeout(6500),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Reverse geocoding provider unavailable");

  const body = await response.json();
  const countryCode = String(body.address?.country_code ?? "").toLowerCase();
  const state = countryCode === "my"
    ? normalizeMalaysiaState(body.address?.state ?? body.address?.region ?? body.display_name)
    : null;
  cache.set(key, { state, expiresAt: Date.now() + CACHE_TTL_MS });
  return state;
}

const forwardCache = new Map<string, { lat: number; lon: number; expiresAt: number }>();

// Free forward geocoding (OpenStreetMap Nominatim) restricted to Malaysia, used to
// derive coordinates from a typed address so businesses never have to look up lat/long.
export async function forwardGeocode(query: string): Promise<{ lat: number; lon: number } | null> {
  const q = query.trim();
  if (!q) return null;
  const cached = forwardCache.get(q);
  if (cached && cached.expiresAt > Date.now()) return { lat: cached.lat, lon: cached.lon };
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "my");
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "QuantumLeapQueue/1.0 (admin@quantumleap.app)", "Accept-Language": "en" },
      signal: AbortSignal.timeout(6500),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = await response.json();
    const first = Array.isArray(body) ? body[0] : null;
    const lat = Number(first?.lat);
    const lon = Number(first?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    forwardCache.set(q, { lat, lon, expiresAt: Date.now() + CACHE_TTL_MS });
    return { lat, lon };
  } catch {
    return null;
  }
}
