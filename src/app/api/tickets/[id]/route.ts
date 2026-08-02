import { eq } from "drizzle-orm";
import { db } from "@/db";
import { queueTickets } from "@/db/schema";
import { canManage, getCurrentUser } from "@/lib/auth";
import { emitQueueChange } from "@/lib/events";
import { renumberTicket } from "@/lib/queue-actions";

async function managerForTicket(id: number) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "business")) return null;
  if (user.role === "admin") return user;
  const [t] = await db.select({ establishmentId: queueTickets.establishmentId }).from(queueTickets).where(eq(queueTickets.id, id)).limit(1);
  if (!t || !(await canManage(user, t.establishmentId))) return null;
  return user;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const user = await managerForTicket(id);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
    const status = String(body.status ?? "");
    if (status === "renumber") {
      const u = await renumberTicket(id);
      if (!u) return Response.json({ error: "Ticket not found." }, { status: 404 });
      return Response.json(u);
    }
    const allowed = ["waiting", "called", "serving", "completed", "no_show", "cancelled"];
  if (!allowed.includes(status)) return Response.json({ error: "Invalid queue status." }, { status: 400 });

  const now = new Date();
  const timestamps: Partial<typeof queueTickets.$inferInsert> = { status, updatedAt: now };
  if (status === "called") timestamps.calledAt = now;
  if (status === "serving") timestamps.startedAt = now;
  if (status === "completed") timestamps.completedAt = now;
  const [updated] = await db.update(queueTickets).set(timestamps).where(eq(queueTickets.id, id)).returning();
  if (!updated) return Response.json({ error: "Ticket not found." }, { status: 404 });
  emitQueueChange(updated.establishmentId);
  return Response.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const user = await managerForTicket(id);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [deleted] = await db.delete(queueTickets).where(eq(queueTickets.id, id)).returning({ id: queueTickets.id, establishmentId: queueTickets.establishmentId });
  if (!deleted) return Response.json({ error: "Ticket not found." }, { status: 404 });
  emitQueueChange(deleted.establishmentId);
  return Response.json({ ok: true });
}
