import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

// Customer self-registration. Creates a `customer` user + session; the customer portal then
// shows their saved queue statuses. (Business signup lives at /api/auth/signup.)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!name || !email || password.length < 6) {
      return Response.json({ error: "Name, email and a password of at least 6 characters are required." }, { status: 400 });
    }
    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (exists) return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash: hashPassword(password), role: "customer" })
      .returning();
    const token = await createSession(user.id);
    return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
  } catch (error) {
    console.error("Customer signup failed", error);
    return Response.json({ error: "Couldn’t create your account. Please try again." }, { status: 500 });
  }
}
