import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { queueTickets, services } from "@/db/schema";
import { canManage, getCurrentUser } from "@/lib/auth";
import { emitQueueChange } from "@/lib/events";

// Walk-in: creates a queue ticket at the desk without any GPS / geofence / state checks. Admins can use any queue; business users only their own.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "business")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const serviceId = Number(body.serviceId);
    const customerName = String(body.customerName ?? "").trim();
    if (!customerName || !Number.isInteger(serviceId)) {
      return Response.json({ error: "Customer name and service are required." }, { status: 400 });
    }
    const [service] = await db
      .select({ id: services.id, establishmentId: services.establishmentId, durationMinutes: services.durationMinutes })
      .from(services)
      .where(eq(services.id, serviceId))
      .limit(1);
    if (!service) return Response.json({ error: "Service not found." }, { status: 404 });
    if (user.role === "business" && !(await canManage(user, service.establishmentId))) return Response.json({ error: "Unauthorized" }, { status: 403 });

    const [total] = await db.select({ value: count() }).from(queueTickets);
    const sequence = 141 + Number(total.value);
    const ticketNumber = `W${String(sequence).padStart(3, "0")}`;
    const [created] = await db
      .insert(queueTickets)
      .values({
        ticketNumber,
        customerName,
        phone: String(body.phone ?? "").trim() || null,
        establishmentId: service.establishmentId,
        serviceId,
        status: "waiting",
        partySize: Math.min(10, Math.max(1, Number(body.partySize) || 1)),
        latitude: null,
        longitude: null,
        distanceKm: "0.00",
        travelMinutes: 0,
        serviceMinutesSnapshot: service.durationMinutes,
      })
      .returning({ publicId: queueTickets.publicId, ticketNumber: queueTickets.ticketNumber });

    emitQueueChange();
    return Response.json(created, { status: 201 });
  } catch (error) {
    console.error("Walk-in failed", error);
    return Response.json({ error: "Couldn’t add the walk-in." }, { status: 500 });
  }
}
