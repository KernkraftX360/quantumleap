import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Returns the authenticated user. Accepts the session from cookie, Authorization
// header, or ?session query — so the client auth-gate can re-authenticate on reload
// using the persisted token even when the cookie is unavailable.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("session");
  const sess = await getSession(queryToken);
  if (!sess) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(sess.user);
}
