import { getSession } from "@/lib/auth";
import { onQueueChange } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-Sent Events stream: pushes a "bump" whenever the queue changes so clients can
// refresh in real time instead of polling. Authenticated via cookie or ?session= token.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sess = await getSession(url.searchParams.get("session"));
  if (!sess || (sess.user.role !== "admin" && sess.user.role !== "business")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* client gone */
        }
      };
      write(`data: ${JSON.stringify({ type: "hello", t: Date.now() })}\n\n`);
      unsubscribe = onQueueChange(() => write(`data: ${JSON.stringify({ type: "queue", t: Date.now() })}\n\n`));
      heartbeat = setInterval(() => write(`:keepalive ${Date.now()}\n\n`), 20000);
      const cleanup = () => {
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        if (unsubscribe) unsubscribe();
        unsubscribe = null;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
