import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { queueTickets } from "@/db/schema";

// The customer's live ticket page pings its current GPS here so the server can decide,
// ~5 minutes before their turn, whether they're within 100m of the venue.
export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const body = await request.json();
  const lat = Number(body.latitude);
  const lon = Number(body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ error: "Valid coordinates are required." }, { status: 400 });
  }
  await db
    .update(queueTickets)
    .set({ lastLat: lat.toFixed(7), lastLon: lon.toFixed(7), lastSeenAt: new Date(), updatedAt: new Date() })
    .where(and(eq(queueTickets.publicId, publicId), inArray(queueTickets.status, ["waiting", "holding"])));
  return Response.json({ ok: true });
}
