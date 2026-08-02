import { eq } from "drizzle-orm";
import { db } from "@/db";
import { establishments, services, users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { SERVICE_TEMPLATES, getCategory, isCategoryId, type CategoryId } from "@/lib/categories";
import { STATE_CENTROIDS, normalizeMalaysiaState } from "@/lib/malaysia-states";
import { forwardGeocode } from "@/lib/reverse-geocode";

// Business onboarding: creates an owner account, their establishment, default services, and a session.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ownerName = String(body.ownerName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const businessName = String(body.businessName ?? "").trim();
    const address = String(body.address ?? "").trim();
    let latitude = Number(body.latitude);
    let longitude = Number(body.longitude);
    const category = isCategoryId(String(body.category)) ? (String(body.category) as CategoryId) : null;
    const state = normalizeMalaysiaState(body.state);
    if (!ownerName || !email || password.length < 6 || !businessName || !address || !category || !state) {
      return Response.json({ error: "Please complete every field. Password must be at least 6 characters, and choose a category and state." }, { status: 400 });
    }
    // Coordinates are optional: resolve them from the address, falling back to the state centroid.
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude === 0 || longitude === 0) {
      const geo = await forwardGeocode(`${address}, ${state}, Malaysia`);
      if (geo) {
        latitude = geo.lat;
        longitude = geo.lon;
      } else {
        const centroid = STATE_CENTROIDS[state];
        if (centroid) {
          latitude = centroid[0];
          longitude = centroid[1];
        } else {
          return Response.json({ error: "We couldn’t map your address automatically — please enter latitude and longitude." }, { status: 400 });
        }
      }
    }
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return Response.json({ error: "An account with this email already exists." }, { status: 409 });

    let createdUser: typeof users.$inferSelect | undefined;
    let createdEst: typeof establishments.$inferSelect | undefined;
    await db.transaction(async (tx) => {
      [createdUser] = await tx.insert(users).values({ name: ownerName, email, passwordHash: hashPassword(password), role: "business" }).returning();
      const slug = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now().toString(36).slice(-4)}`;
      [createdEst] = await tx
        .insert(establishments)
        .values({
          name: businessName,
          slug,
          address,
          latitude: latitude.toFixed(7),
          longitude: longitude.toFixed(7),
          phone: String(body.phone ?? "").trim() || null,
          status: "open",
          openingTime: String(body.openingTime ?? "08:00"),
          closingTime: String(body.closingTime ?? "18:00"),
          accent: getCategory(category).accent,
          category,
          state,
          ownerUserId: createdUser!.id,
        })
        .returning();
      const templates = SERVICE_TEMPLATES[category];
      await tx.insert(services).values(
        templates.map((s) => ({
          establishmentId: createdEst!.id,
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          capacity: s.capacity,
          color: s.color,
        })),
      );
    });

    const token = await createSession(createdUser!.id);
    return Response.json(
      {
        user: { id: createdUser!.id, name: createdUser!.name, email: createdUser!.email, role: createdUser!.role },
        establishmentId: createdEst!.id,
        token,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Signup failed", error);
    return Response.json({ error: "Couldn’t create your account. Please try again." }, { status: 500 });
  }
}
