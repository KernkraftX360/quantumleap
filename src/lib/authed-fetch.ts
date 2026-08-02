// Reads the session token the client persisted (memory + localStorage) and builds
// request headers that carry it as a Bearer token. This lets authenticated requests
// work even when the httpOnly session cookie can't be stored (embedded contexts),
// which is what keeps a signed-in user signed in across reloads.
export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __QL_SESSION__?: string };
  if (w.__QL_SESSION__) return w.__QL_SESSION__;
  try {
    const ls = localStorage.getItem("ql_session");
    if (ls) {
      w.__QL_SESSION__ = ls;
      return ls;
    }
  } catch {
    /* storage blocked */
  }
  // After the login redirect the token lives in the URL (?session=…). Read it and stash it
  // to memory so it survives the later URL cleanup — this is what keeps actions authenticated
  // in embedded contexts where both the cookie and localStorage are unavailable.
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("session");
    if (fromUrl) {
      w.__QL_SESSION__ = fromUrl;
      try {
        localStorage.setItem("ql_session", fromUrl);
      } catch {
        /* storage blocked */
      }
      return fromUrl;
    }
  } catch {
    /* no URL access */
  }
  return null;
}

export function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra as HeadersInit | undefined);
  const token = getSessionToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}
