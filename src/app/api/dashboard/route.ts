import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/queue";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "business")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSeeded();
  const data = await getDashboardData(user.role === "business" ? user.id : undefined);
  return Response.json(data);
}
