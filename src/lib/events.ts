import { EventEmitter } from "node:events";

// Tiny in-process pub/sub so route handlers can notify live SSE clients the instant the
// queue changes. Stored on globalThis so a single emitter/registry is shared even if the
// module is bundled more than once. Single-server-process scope (sufficient here).
const KEY = "__ql_queue_events__";
const SUBKEY = "__ql_ticket_subs__";
type G = typeof globalThis & { [KEY]?: EventEmitter; [SUBKEY]?: Set<TicketSub> };
type TicketSub = { estId: number; controller: ReadableStreamDefaultController<Uint8Array> };
const encoder = new TextEncoder();

function bus(): EventEmitter {
  const g = globalThis as G;
  if (!g[KEY]) {
    const e = new EventEmitter();
    e.setMaxListeners(0);
    g[KEY] = e;
  }
  return g[KEY];
}
function subs(): Set<TicketSub> {
  const g = globalThis as G;
  if (!g[SUBKEY]) g[SUBKEY] = new Set();
  return g[SUBKEY];
}

// Notify the admin event bus (all queues) and every public customer stream whose ticket
// belongs to the affected establishment, so customers update the instant the admin acts.
export function emitQueueChange(establishmentId?: number) {
  bus().emit("change", { t: Date.now(), establishmentId });
  for (const sub of subs()) {
    if (establishmentId == null || sub.estId === establishmentId) {
      try {
        sub.controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t: Date.now() })}\n\n`));
      } catch {
        /* stream closed */
      }
    }
  }
}

export function onQueueChange(cb: () => void): () => void {
  bus().on("change", cb);
  return () => bus().off("change", cb);
}

export function subscribeTicketStream(
  estId: number,
  controller: ReadableStreamDefaultController<Uint8Array>,
): () => void {
  const sub = { estId, controller };
  subs().add(sub);
  return () => subs().delete(sub);
}
