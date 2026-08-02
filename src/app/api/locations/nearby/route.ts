import { hasValidCoordinates } from "@/lib/geofence";
import { getPublicLocations } from "@/lib/queue";
import { reverseGeocodeMalaysiaState } from "@/lib/reverse-geocode";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const coords = {
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
    };
    if (!hasValidCoordinates(coords)) {
      return Response.json({ error: "Valid GPS coordinates are required." }, { status: 400 });
    }

    const state = await reverseGeocodeMalaysiaState(coords);
    if (!state) {
      return Response.json(
        { error: "Your GPS location could not be matched to a supported Malaysian state." },
        { status: 422 },
      );
    }

    await ensureSeeded();
    const locations = await getPublicLocations(state);
    return Response.json({ state, locations });
  } catch (error) {
    console.error("Nearby location lookup failed", error);
    return Response.json(
      { error: "We couldn’t verify your state right now. Please try again." },
      { status: 503 },
    );
  }
}
