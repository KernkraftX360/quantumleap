import { getCurrentUser } from "@/lib/auth";
import { sweepAutoRequeue } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

// Manual tick for ops (and tests): run the auto-reschedule sweep on demand.
export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const moved = await sweepAutoRequeue();
  return Response.json({ ok: true, moved });
}
