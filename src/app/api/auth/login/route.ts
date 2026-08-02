import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { ensureSeeded } from "@/lib/seed";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) return Response.json({ error: "Email and password are required." }, { status: 400 });

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return Response.json({ error: "That email or password doesn’t match." }, { status: 401 });
    }
    // Role gating happens per page (/dashboard vs /account); any verified user may sign in.

    const token = await createSession(user.id);
    return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
  } catch (error) {
    console.error("Login failed", error);
    return Response.json({ error: "We couldn’t sign you in. Please try again." }, { status: 500 });
  }
}
