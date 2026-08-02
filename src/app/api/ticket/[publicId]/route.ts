import { eq } from "drizzle-orm";
import { db } from "@/db";
import { queueTickets } from "@/db/schema";
import { getTicketDetails } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const publicId = (await params).publicId;
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return Response.json({ error: "Ticket not found." }, { status: 404 });
  const ticket = await getTicketDetails(publicId);
  if (!ticket) return Response.json({ error: "Ticket not found." }, { status: 404 });
  return Response.json(ticket);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const publicId = (await params).publicId;
  const body = await request.json();
  if (body.action !== "cancel") return Response.json({ error: "Unsupported action." }, { status: 400 });
  const [updated] = await db
    .update(queueTickets)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(queueTickets.publicId, publicId))
    .returning({ publicId: queueTickets.publicId });
  if (!updated) return Response.json({ error: "Ticket not found." }, { status: 404 });
  return Response.json({ ok: true });
}
