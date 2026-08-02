import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { establishments, sessions, users } from "@/db/schema";

const SESSION_COOKIE = "quantum_leap_session";
const SESSION_DAYS = 14;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ tokenHash: tokenHash(token), userId, expiresAt });
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  // SameSite=None + Secure + Partitioned (CHIPS) so the cookie survives embedded contexts too.
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: secure ? "none" : "lax",
    secure,
    partitioned: secure,
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
  const secure = process.env.NODE_ENV === "production";
  cookieStore.delete({ name: SESSION_COOKIE, path: "/", sameSite: secure ? "none" : "lax", secure, partitioned: secure });
}

// The session token can arrive via cookie, Authorization header, or ?session query —
// the latter two make auth work even when the cookie can't be stored.
async function resolveSessionToken(override?: string | null): Promise<string | null> {
  if (override) return override;
  const cookieToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (cookieToken) return cookieToken;
  const h = await headers();
  const auth = h.get("authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m?.[1]) return m[1].trim();
  }
  const xql = h.get("x-ql-session");
  if (xql) return xql;
  return null;
}

export async function getSession(override?: string | null) {
  const token = await resolveSessionToken(override);
  if (!token) return null;
  const [result] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, avatarUrl: users.avatarUrl })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!result) return null;
  return { token, user: result };
}

export async function getCurrentUser(override?: string | null) {
  const s = await getSession(override);
  return s?.user ?? null;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/login");
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "business")) redirect("/login");
  return user;
}

export async function userOwnsEstablishment(userId: number, establishmentId: number) {
  const [row] = await db
    .select({ ownerUserId: establishments.ownerUserId })
    .from(establishments)
    .where(eq(establishments.id, establishmentId))
    .limit(1);
  return !!row && row.ownerUserId === userId;
}

export async function canManage(user: { id: number; role: string } | null, establishmentId: number) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "business") return userOwnsEstablishment(user.id, establishmentId);
  return false;
}
