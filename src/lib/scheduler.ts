import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { establishments, queueTickets, services } from "@/db/schema";
import { haversineKm } from "@/lib/geofence";
import { renumberTicket } from "@/lib/queue-actions";

// Watchdog: ~5 min before a customer's turn, if their latest GPS isn't within 100 m of the
// venue we put them on hold (status "holding") and ask them — via their live screen — whether
// they want a new number or to cancel. If they don't answer within HOLD_TIMEOUT_MS we assign a
// new number for them (so they're never silently cancelled).
const KEY = "__ql_scheduler__";
const NEAR_M = 0.1; // 100 m
const WITHIN_TURN_MIN = 5;
const PING_FRESH_MS = 120_000; // ignore pings older than 2 min
const HOLD_TIMEOUT_MS = 180_000; // 3 min to respond before auto new-number

type W = {
  id: number;
  serviceId: number;
  serviceMinutesSnapshot: number;
  capacity: number;
  joinedAt: Date | string;
  lastLat: string | null;
  lastLon: string | null;
  lastSeenAt: Date | string | null;
  eLat: string;
  eLon: string;
};

export async function sweepAutoRequeue() {
  const now = Date.now();
  let changed = 0;

  // Pass 1: held tickets with no decision past the timeout -> auto new number (customer notified).
  const stale = await db
    .select({ id: queueTickets.id })
    .from(queueTickets)
    .where(
      and(
        eq(queueTickets.status, "holding"),
        sql`${queueTickets.needsActionAt} is not null`,
        sql`${queueTickets.needsActionAt} < ${new Date(now - HOLD_TIMEOUT_MS)}`,
      ),
    );
  for (const t of stale) {
    const u = await renumberTicket(t.id);
    if (u) changed++;
  }

  // Pass 2: flag waiting tickets ~5 min from turn whose recent GPS is not within 100 m.
  const waiting = await db
    .select({
      id: queueTickets.id,
      serviceId: queueTickets.serviceId,
      serviceMinutesSnapshot: queueTickets.serviceMinutesSnapshot,
      capacity: services.capacity,
      joinedAt: queueTickets.joinedAt,
      lastLat: queueTickets.lastLat,
      lastLon: queueTickets.lastLon,
      lastSeenAt: queueTickets.lastSeenAt,
      eLat: establishments.latitude,
      eLon: establishments.longitude,
    })
    .from(queueTickets)
    .innerJoin(establishments, eq(queueTickets.establishmentId, establishments.id))
    .innerJoin(services, eq(queueTickets.serviceId, services.id))
    .where(eq(queueTickets.status, "waiting"));

  const bySvc = new Map<number, W[]>();
  for (const t of waiting) {
    const arr = bySvc.get(t.serviceId) ?? [];
    arr.push(t);
    bySvc.set(t.serviceId, arr);
  }
  for (const list of bySvc.values()) {
    list.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
    for (let idx = 0; idx < list.length; idx++) {
      const t = list[idx];
      if (idx < 1) continue; // next in line: don't hold (a genuine no-show is handled by staff)
      const waitMin = Math.ceil((idx * t.serviceMinutesSnapshot) / Math.max(1, t.capacity));
      if (waitMin > WITHIN_TURN_MIN) continue;
      if (!t.lastSeenAt || t.lastLat == null || t.lastLon == null) continue; // no live GPS to judge
      if (now - new Date(t.lastSeenAt).getTime() > PING_FRESH_MS) continue; // stale ping
      const dist = haversineKm(
        { latitude: Number(t.lastLat), longitude: Number(t.lastLon) },
        { latitude: Number(t.eLat), longitude: Number(t.eLon) },
      );
      if (dist <= NEAR_M) continue; // within 100 m -> they're here, leave them be
      await db
        .update(queueTickets)
        .set({ status: "holding", needsActionAt: new Date(now), updatedAt: new Date(now) })
        .where(eq(queueTickets.id, t.id));
      changed++;
    }
  }

  if (changed) {
    const { emitQueueChange } = await import("@/lib/events");
    emitQueueChange();
  }
  return changed;
}

export function startScheduler() {
  const g = globalThis as unknown as Record<string, unknown>;
  if (g[KEY]) return;
  g[KEY] = setInterval(() => {
    sweepAutoRequeue().catch((e) => console.error("queue watchdog failed", e));
  }, 30_000);
}
