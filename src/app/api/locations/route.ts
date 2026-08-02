import { asc } from "drizzle-orm";
import { db } from "@/db";
import { establishments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isCategoryId } from "@/lib/categories";
import { getPublicLocations } from "@/lib/queue";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  return Response.json(await getPublicLocations());
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const address = String(body.address ?? "").trim();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!name || !address || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return Response.json({ error: "Name, address, latitude, and longitude are required." }, { status: 400 });
    }
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now().toString().slice(-5)}`;
    const [created] = await db.insert(establishments).values({
      name,
      slug,
      address,
      latitude: latitude.toFixed(7),
      longitude: longitude.toFixed(7),
      phone: String(body.phone ?? "") || null,
      status: String(body.status ?? "open"),
      openingTime: String(body.openingTime ?? "08:00"),
      closingTime: String(body.closingTime ?? "18:00"),
      accent: String(body.accent ?? "emerald"),
      category: isCategoryId(String(body.category ?? "")) ? String(body.category) : "medical",
      state: String(body.state ?? "").trim() || null,
    }).returning();
    return Response.json(created, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not create this location." }, { status: 500 });
  }
}
