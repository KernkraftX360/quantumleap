// Signs the user out everywhere: clears the client-side session token (so the
// auth fetch-patch can't silently re-authenticate), tells the server to drop the
// cookie/session, then does a full navigation to reset all client state.
export async function signOut() {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("ql_session");
    } catch {
      /* storage blocked */
    }
    (window as unknown as { __QL_SESSION__?: string }).__QL_SESSION__ = undefined;
  }
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") window.location.href = "/login";
}
