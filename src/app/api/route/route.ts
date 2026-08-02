import { getRouteEstimate } from "@/lib/routing";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const origin = { latitude: Number(body.origin?.latitude), longitude: Number(body.origin?.longitude) };
    const destination = { latitude: Number(body.destination?.latitude), longitude: Number(body.destination?.longitude) };
    if (![origin.latitude, origin.longitude, destination.latitude, destination.longitude].every(Number.isFinite)) {
      return Response.json({ error: "Valid origin and destination coordinates are required." }, { status: 400 });
    }
    return Response.json(await getRouteEstimate(origin, destination));
  } catch {
    return Response.json({ error: "A route estimate isn’t available right now." }, { status: 503 });
  }
}
