import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { queueTickets } from "@/db/schema";
import { emitQueueChange } from "@/lib/events";

// Move a ticket to the back of its queue with a brand-new number (never a cancellation).
// Records the previous number and bumps requeuedAt so the customer is notified of the new number.
export async function renumberTicket(id: number) {
  const [t] = await db
    .select({ ticketNumber: queueTickets.ticketNumber })
    .from(queueTickets)
    .where(eq(queueTickets.id, id))
    .limit(1);
  if (!t) return null;
  const [total] = await db.select({ v: sql<number>`count(*)::int` }).from(queueTickets);
  const seq = 141 + Number(total.v) + 1;
  const newNumber = `A${String(seq).padStart(3, "0")}`;
  const now = new Date();
  const [updated] = await db
    .update(queueTickets)
    .set({
      previousNumber: t.ticketNumber,
      ticketNumber: newNumber,
      status: "waiting",
      joinedAt: now,
      requeuedAt: now,
      needsActionAt: null,
      requeueCount: sql`${queueTickets.requeueCount} + 1`,
      calledAt: null,
      startedAt: null,
      updatedAt: now,
    })
    .where(eq(queueTickets.id, id))
    .returning();
  emitQueueChange();
  return updated ?? null;
}

export async function cancelTicket(id: number) {
  const [updated] = await db
    .update(queueTickets)
    .set({ status: "cancelled", needsActionAt: null, updatedAt: new Date() })
    .where(eq(queueTickets.id, id))
    .returning();
  emitQueueChange();
  return updated ?? null;
}
