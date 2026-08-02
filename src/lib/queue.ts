import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { establishments, queueTickets, services } from "@/db/schema";
import { getEstablishmentState, normalizeMalaysiaState } from "@/lib/malaysia-states";

export const activeStatuses = ["waiting", "called", "serving"];

export type NoShowDay = { label: string; noShow: number; completed: number; cancelled: number };
export type NoShowAnalytics = {
  days: NoShowDay[];
  totalNoShow: number;
  totalCompleted: number;
  totalCancelled: number;
  noShowRate: number;
  completedToday: number;
  hotspots: { name: string; count: number }[];
};

export async function getPublicLocations(requestedState?: string) {
  const locations = await db.select().from(establishments).orderBy(asc(establishments.id));
  const serviceRows = await db.select().from(services).where(eq(services.active, true)).orderBy(asc(services.id));
  const activeCounts = await db
    .select({ establishmentId: queueTickets.establishmentId, value: sql<number>`count(*)::int` })
    .from(queueTickets)
    .where(inArray(queueTickets.status, activeStatuses))
    .groupBy(queueTickets.establishmentId);

  const stateFilter = normalizeMalaysiaState(requestedState);
  const enrichedLocations = locations.map((location) => ({
    ...location,
    state: getEstablishmentState(location),
    services: serviceRows.filter((service) => service.establishmentId === location.id),
    peopleWaiting: activeCounts.find((item) => item.establishmentId === location.id)?.value ?? 0,
  }));

  return stateFilter ? enrichedLocations.filter((location) => location.state === stateFilter) : enrichedLocations;
}

export async function getTicketDetails(publicId: string) {
  const [ticket] = await db
    .select({
      id: queueTickets.id,
      publicId: queueTickets.publicId,
      ticketNumber: queueTickets.ticketNumber,
      customerName: queueTickets.customerName,
      phone: queueTickets.phone,
      status: queueTickets.status,
      joinedAt: queueTickets.joinedAt,
      updatedAt: queueTickets.updatedAt,
      travelMinutes: queueTickets.travelMinutes,
      distanceKm: queueTickets.distanceKm,
      originLatitude: queueTickets.latitude,
      originLongitude: queueTickets.longitude,
      serviceMinutesSnapshot: queueTickets.serviceMinutesSnapshot,
      establishmentId: queueTickets.establishmentId,
      serviceId: queueTickets.serviceId,
      establishmentName: establishments.name,
      address: establishments.address,
      latitude: establishments.latitude,
      longitude: establishments.longitude,
      serviceName: services.name,
      serviceCapacity: services.capacity,
      requeuedAt: queueTickets.requeuedAt,
      previousNumber: queueTickets.previousNumber,
    })
    .from(queueTickets)
    .innerJoin(establishments, eq(queueTickets.establishmentId, establishments.id))
    .innerJoin(services, eq(queueTickets.serviceId, services.id))
    .where(eq(queueTickets.publicId, publicId))
    .limit(1);
  if (!ticket) return null;

  const [aheadResult] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(queueTickets)
    .where(and(eq(queueTickets.serviceId, ticket.serviceId), inArray(queueTickets.status, activeStatuses), lt(queueTickets.joinedAt, ticket.joinedAt)));
  const ahead = ticket.status === "waiting" ? aheadResult.value : 0;
  const waitMinutes =
    ticket.status === "waiting"
      ? Math.max(2, Math.ceil((ahead * ticket.serviceMinutesSnapshot) / Math.max(1, ticket.serviceCapacity)))
      : 0;

  return {
    ...ticket,
    peopleAhead: ahead,
    waitMinutes,
    leaveInMinutes: Math.max(0, waitMinutes - ticket.travelMinutes - 5),
    estimatedServiceAt: new Date(Date.now() + waitMinutes * 60_000).toISOString(),
  };
}

function utcDayKey(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);
}

function last7DayLabels() {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { weekday: "short" }) });
  }
  return out;
}

async function computeNoShowAnalytics(locIds: number[]): Promise<NoShowAnalytics> {
  const labels = last7DayLabels();
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - 6));
  const scope = locIds.length ? inArray(queueTickets.establishmentId, locIds) : sql`true`;
  const rows = await db
    .select({
      day: sql<string>`to_char(${queueTickets.joinedAt} at time zone 'UTC', 'YYYY-MM-DD')`,
      status: queueTickets.status,
      n: sql<number>`count(*)::int`,
    })
    .from(queueTickets)
    .where(and(gte(queueTickets.joinedAt, since), inArray(queueTickets.status, ["completed", "no_show", "cancelled"]), scope))
    .groupBy(sql`to_char(${queueTickets.joinedAt} at time zone 'UTC', 'YYYY-MM-DD')`, queueTickets.status);

  const byDay = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const m = byDay.get(r.day) ?? { no_show: 0, completed: 0, cancelled: 0 };
    m[r.status] = (m[r.status] ?? 0) + r.n;
    byDay.set(r.day, m);
  }
  const days = labels.map((l) => {
    const m = byDay.get(l.key) ?? { no_show: 0, completed: 0, cancelled: 0 };
    return { label: l.label, noShow: m.no_show ?? 0, completed: m.completed ?? 0, cancelled: m.cancelled ?? 0 };
  });
  const totalNoShow = days.reduce((s, d) => s + d.noShow, 0);
  const totalCompleted = days.reduce((s, d) => s + d.completed, 0);
  const totalCancelled = days.reduce((s, d) => s + d.cancelled, 0);
  const noShowRate = totalNoShow + totalCompleted > 0 ? Math.round((totalNoShow / (totalNoShow + totalCompleted)) * 1000) / 10 : 0;
  const completedToday = days[days.length - 1]?.completed ?? 0;

  const hot = locIds.length
    ? await db
        .select({ name: establishments.name, n: sql<number>`count(*)::int` })
        .from(queueTickets)
        .innerJoin(establishments, eq(queueTickets.establishmentId, establishments.id))
        .where(and(eq(queueTickets.status, "no_show"), gte(queueTickets.joinedAt, since), inArray(queueTickets.establishmentId, locIds)))
        .groupBy(establishments.name)
        .orderBy(desc(sql`count(*)`))
        .limit(5)
    : [];
  const hotspots = hot.map((h) => ({ name: h.name, count: h.n }));

  return { days, totalNoShow, totalCompleted, totalCancelled, noShowRate, completedToday, hotspots };
}

export async function getDashboardData(ownerUserId?: number | null) {
  const locations =
    ownerUserId != null
      ? await db.select().from(establishments).where(eq(establishments.ownerUserId, ownerUserId)).orderBy(asc(establishments.id))
      : await db.select().from(establishments).orderBy(asc(establishments.id));
  const locIds = locations.map((l) => l.id);
  const serviceRows = locIds.length
    ? await db.select().from(services).where(inArray(services.establishmentId, locIds)).orderBy(asc(services.id))
    : [];
  const tickets = locIds.length
    ? await db
        .select({
          id: queueTickets.id,
          publicId: queueTickets.publicId,
          ticketNumber: queueTickets.ticketNumber,
          customerName: queueTickets.customerName,
          phone: queueTickets.phone,
          status: queueTickets.status,
          partySize: queueTickets.partySize,
          travelMinutes: queueTickets.travelMinutes,
          distanceKm: queueTickets.distanceKm,
          joinedAt: queueTickets.joinedAt,
          updatedAt: queueTickets.updatedAt,
          calledAt: queueTickets.calledAt,
          startedAt: queueTickets.startedAt,
          completedAt: queueTickets.completedAt,
          establishmentId: queueTickets.establishmentId,
          serviceId: queueTickets.serviceId,
          establishmentName: establishments.name,
          serviceName: services.name,
          durationMinutes: services.durationMinutes,
          requeuedAt: queueTickets.requeuedAt,
          previousNumber: queueTickets.previousNumber,
        })
        .from(queueTickets)
        .innerJoin(establishments, eq(queueTickets.establishmentId, establishments.id))
        .innerJoin(services, eq(queueTickets.serviceId, services.id))
        .where(inArray(queueTickets.establishmentId, locIds))
        .orderBy(desc(queueTickets.joinedAt))
        .limit(100)
    : [];
  const noShowAnalytics = await computeNoShowAnalytics(locIds);
  return { locations, services: serviceRows, tickets, noShowAnalytics };
}
