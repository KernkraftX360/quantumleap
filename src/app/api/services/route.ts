import { db } from "@/db";
import { services } from "@/db/schema";
import { canManage, getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "business")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const establishmentId = Number(body.establishmentId);
    if (!name || !Number.isInteger(establishmentId)) return Response.json({ error: "Service name and location are required." }, { status: 400 });
    if (user.role === "business" && !(await canManage(user, establishmentId))) return Response.json({ error: "Unauthorized" }, { status: 403 });
    const [created] = await db
      .insert(services)
      .values({
        name,
        establishmentId,
        description: String(body.description ?? "") || null,
        durationMinutes: Math.max(1, Number(body.durationMinutes) || 10),
        capacity: Math.max(1, Number(body.capacity) || 1),
        color: String(body.color ?? "emerald"),
        active: body.active !== false,
      })
      .returning();
    return Response.json(created, { status: 201 });
  } catch {
    return Response.json({ error: "Could not create this service." }, { status: 500 });
  }
}
