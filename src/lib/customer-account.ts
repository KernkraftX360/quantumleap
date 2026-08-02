import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { establishments, queueTickets, services, users } from "@/db/schema";

export type CustomerUser = { id: number; name: string; email: string };
export type CustomerTicket = {
  id: number;
  publicId: string;
  ticketNumber: string;
  status: string;
  joinedAt: Date | string;
  updatedAt: Date | string;
  partySize: number;
  serviceName: string;
  establishmentName: string;
  peopleAhead?: number;
  waitMinutes?: number;
};
export type AccountData = { user: CustomerUser; active: CustomerTicket[]; history: CustomerTicket[] };

const ACTIVE = ["waiting", "called", "serving", "holding"];

export async function getCustomerAccount(userId: number): Promise<AccountData> {
  const rows = await db
    .select({
      id: queueTickets.id,
      publicId: queueTickets.publicId,
      ticketNumber: queueTickets.ticketNumber,
      status: queueTickets.status,
      joinedAt: queueTickets.joinedAt,
      updatedAt: queueTickets.updatedAt,
      partySize: queueTickets.partySize,
      serviceName: services.name,
      establishmentName: establishments.name,
    })
    .from(queueTickets)
    .innerJoin(services, eq(queueTickets.serviceId, services.id))
    .innerJoin(establishments, eq(queueTickets.establishmentId, establishments.id))
    .where(eq(queueTickets.userId, userId))
    .orderBy(desc(queueTickets.joinedAt));

  const [userRow] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user: CustomerUser = userRow
    ? { id: userRow.id, name: userRow.name, email: userRow.email }
    : { id: userId, name: "", email: "" };

  return {
    user,
    active: rows.filter((r) => ACTIVE.includes(r.status)),
    history: rows.filter((r) => !ACTIVE.includes(r.status)).slice(0, 12),
  };
}
