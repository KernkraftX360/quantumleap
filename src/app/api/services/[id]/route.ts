import { eq } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { canManage, getCurrentUser } from "@/lib/auth";

async function managerForService(id: number) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "business")) return null;
  if (user.role === "admin") return user;
  const [s] = await db.select({ establishmentId: services.establishmentId }).from(services).where(eq(services.id, id)).limit(1);
  if (!s || !(await canManage(user, s.establishmentId))) return null;
  return user;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const user = await managerForService(id);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  if (user.role === "business" && body.establishmentId !== undefined && !(await canManage(user, Number(body.establishmentId)))) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }
  const values: Partial<typeof services.$inferInsert> = {};
  if (body.name !== undefined) values.name = String(body.name).trim();
  if (body.description !== undefined) values.description = String(body.description) || null;
  if (body.establishmentId !== undefined) values.establishmentId = Number(body.establishmentId);
  if (body.durationMinutes !== undefined) values.durationMinutes = Math.max(1, Number(body.durationMinutes));
  if (body.capacity !== undefined) values.capacity = Math.max(1, Number(body.capacity));
  if (body.color !== undefined) values.color = String(body.color);
  if (body.active !== undefined) values.active = Boolean(body.active);
  const [updated] = await db.update(services).set(values).where(eq(services.id, id)).returning();
  if (!updated) return Response.json({ error: "Service not found." }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const user = await managerForService(id);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [deleted] = await db.delete(services).where(eq(services.id, id)).returning({ id: services.id });
  if (!deleted) return Response.json({ error: "Service not found." }, { status: 404 });
  return Response.json({ ok: true });
}
