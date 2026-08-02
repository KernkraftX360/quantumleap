import { eq } from "drizzle-orm";
import { db } from "@/db";
import { queueTickets } from "@/db/schema";
import { subscribeTicketStream } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public, possession-based stream (the publicId is an unguessable UUID): pushes a bump the
// instant this ticket's queue changes, so the customer's screen updates the moment the admin
// calls / serves / completes / renumbers / cancels — no waiting on the poll interval.
export async function GET(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const [t] = await db
    .select({ establishmentId: queueTickets.establishmentId })
    .from(queueTickets)
    .where(eq(queueTickets.publicId, publicId))
    .limit(1);
  if (!t) return Response.json({ error: "Ticket not found." }, { status: 404 });

  const encoder = new TextEncoder();
  let unsub: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t: Date.now(), hello: true })}\n\n`));
      unsub = subscribeTicketStream(t.establishmentId, controller);
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`:ping ${Date.now()}\n\n`));
        } catch {
          /* closed */
        }
      }, 20000);
      request.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        unsub?.();
        try {
          controller.close();
        } catch {
          /* closed */
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsub?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
