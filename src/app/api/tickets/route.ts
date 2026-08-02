import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { establishments, queueTickets, services } from "@/db/schema";
import { hasValidCoordinates, haversineKm, MAX_JOIN_DISTANCE_KM } from "@/lib/geofence";
import { getEstablishmentState } from "@/lib/malaysia-states";
import { reverseGeocodeMalaysiaState } from "@/lib/reverse-geocode";
import { getRouteEstimate } from "@/lib/routing";
import { ensureSeeded } from "@/lib/seed";
import { getCurrentUser } from "@/lib/auth";
import { emitQueueChange } from "@/lib/events";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await request.json();
    const serviceId = Number(body.serviceId);
    const customerName = String(body.customerName ?? "").trim();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!customerName || !Number.isInteger(serviceId)) {
      return Response.json({ error: "Your name and a service are required." }, { status: 400 });
    }

    const origin = { latitude, longitude };
    if (!hasValidCoordinates(origin)) {
      return Response.json(
        {
          code: "GPS_REQUIRED",
          error: "A valid GPS location is required to join. Enable location access and try again.",
        },
        { status: 422 },
      );
    }

    const [selected] = await db
      .select({
        serviceId: services.id,
        establishmentId: services.establishmentId,
        durationMinutes: services.durationMinutes,
        active: services.active,
        establishmentStatus: establishments.status,
        state: establishments.state,
        slug: establishments.slug,
        address: establishments.address,
        latitude: establishments.latitude,
        longitude: establishments.longitude,
      })
      .from(services)
      .innerJoin(establishments, eq(services.establishmentId, establishments.id))
      .where(eq(services.id, serviceId))
      .limit(1);
    if (!selected || !selected.active) return Response.json({ error: "This service is not currently accepting joins." }, { status: 404 });
    if (selected.establishmentStatus === "paused" || selected.establishmentStatus === "closed") {
      return Response.json(
        { code: "QUEUE_PAUSED", error: selected.establishmentStatus === "paused" ? "This queue is paused right now." : "This location is currently closed." },
        { status: 409 },
      );
    }

    const destination = {
      latitude: Number(selected.latitude),
      longitude: Number(selected.longitude),
    };
    const geofenceDistanceKm = haversineKm(origin, destination);
    if (geofenceDistanceKm > MAX_JOIN_DISTANCE_KM) {
      return Response.json(
        {
          code: "OUTSIDE_SERVICE_RADIUS",
          error: `You must be within ${MAX_JOIN_DISTANCE_KM} km of this establishment to join its queue.`,
          distanceKm: Math.round(geofenceDistanceKm * 10) / 10,
          maxDistanceKm: MAX_JOIN_DISTANCE_KM,
        },
        { status: 403 },
      );
    }

    let userState: Awaited<ReturnType<typeof reverseGeocodeMalaysiaState>>;
    try {
      userState = await reverseGeocodeMalaysiaState(origin);
    } catch {
      return Response.json(
        { code: "STATE_LOOKUP_UNAVAILABLE", error: "We couldn’t verify your GPS state. Please try again." },
        { status: 503 },
      );
    }
    const establishmentState = getEstablishmentState(selected);
    if (!userState || !establishmentState) {
      return Response.json(
        { code: "STATE_REQUIRED", error: "Your GPS state or the establishment state could not be verified." },
        { status: 422 },
      );
    }
    if (userState !== establishmentState) {
      return Response.json(
        {
          code: "STATE_MISMATCH",
          error: `You can only join establishments in your current state (${userState}).`,
          userState,
          establishmentState,
        },
        { status: 403 },
      );
    }

    const route = await getRouteEstimate(origin, destination);
    const cu = await getCurrentUser();
    const userId = cu?.role === "customer" ? cu.id : null;

    const [total] = await db.select({ value: count() }).from(queueTickets);
    const sequence = 141 + Number(total.value);
    const ticketNumber = `A${String(sequence).padStart(3, "0")}`;
    const [created] = await db.insert(queueTickets).values({
      ticketNumber,
      customerName,
      phone: String(body.phone ?? "").trim() || null,
      establishmentId: selected.establishmentId,
      serviceId,
      userId,
      status: "waiting",
      partySize: Math.min(10, Math.max(1, Number(body.partySize) || 1)),
      latitude: Number.isFinite(latitude) ? latitude.toFixed(7) : null,
      longitude: Number.isFinite(longitude) ? longitude.toFixed(7) : null,
      distanceKm: route.distanceKm.toFixed(2),
      travelMinutes: route.travelMinutes,
      serviceMinutesSnapshot: selected.durationMinutes,
    }).returning({ publicId: queueTickets.publicId, ticketNumber: queueTickets.ticketNumber });

    emitQueueChange();
    return Response.json({ ...created, route }, { status: 201 });
  } catch (error) {
    console.error("Queue join failed", error);
    return Response.json({ error: "We couldn’t reserve your place. Please try again." }, { status: 500 });
  }
}
