import { eq } from "drizzle-orm";
import { db } from "@/db";
import { queueTickets } from "@/db/schema";
import { cancelTicket, renumberTicket } from "@/lib/queue-actions";

// Customer's consent response to the "not at venue" watchdog prompt.
export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const body = await request.json();
  const choice = String(body.choice ?? "");
  if (choice !== "renumber" && choice !== "cancel") {
    return Response.json({ error: "Invalid choice." }, { status: 400 });
  }
  const [t] = await db
    .select({ id: queueTickets.id, status: queueTickets.status })
    .from(queueTickets)
    .where(eq(queueTickets.publicId, publicId))
    .limit(1);
  if (!t) return Response.json({ error: "Ticket not found." }, { status: 404 });
  if (t.status !== "holding") {
    return Response.json({ error: "No action is pending for this ticket." }, { status: 409 });
  }
  const updated = choice === "renumber" ? await renumberTicket(t.id) : await cancelTicket(t.id);
  if (!updated) return Response.json({ error: "Couldn’t update your ticket." }, { status: 500 });
  return Response.json({ ok: true, ticketNumber: updated.ticketNumber, status: updated.status });
}
