import { eq } from "drizzle-orm";
import { db } from "@/db";
import { establishments } from "@/db/schema";
import { canManage, getCurrentUser } from "@/lib/auth";

async function managerFor(id: number) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "business")) return null;
  if (user.role === "business" && !(await canManage(user, id))) return null;
  return user;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const user = await managerFor(id);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const values: Partial<typeof establishments.$inferInsert> = {};
  if (body.name !== undefined) values.name = String(body.name).trim();
  if (body.address !== undefined) values.address = String(body.address).trim();
  if (body.phone !== undefined) values.phone = String(body.phone) || null;
  if (body.status !== undefined) values.status = String(body.status);
  if (body.openingTime !== undefined) values.openingTime = String(body.openingTime);
  if (body.closingTime !== undefined) values.closingTime = String(body.closingTime);
  if (body.accent !== undefined) values.accent = String(body.accent);
  if (body.category !== undefined) values.category = String(body.category);
  if (body.state !== undefined) values.state = String(body.state) || null;
  if (body.latitude !== undefined && Number.isFinite(Number(body.latitude))) values.latitude = Number(body.latitude).toFixed(7);
  if (body.longitude !== undefined && Number.isFinite(Number(body.longitude))) values.longitude = Number(body.longitude).toFixed(7);
  const [updated] = await db.update(establishments).set(values).where(eq(establishments.id, id)).returning();
  if (!updated) return Response.json({ error: "Location not found." }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  const [deleted] = await db.delete(establishments).where(eq(establishments.id, id)).returning({ id: establishments.id });
  if (!deleted) return Response.json({ error: "Location not found." }, { status: 404 });
  return Response.json({ ok: true });
}
