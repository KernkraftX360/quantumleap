// Patches the global fetch so every same-origin request automatically carries the
// session token as an Authorization header (read from memory/localStorage). This lets
// the dashboard keep working in environments where the session cookie can't be set
// (embedded / third-party contexts), without touching every call site.
export function installAuthFetch() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __qlFetchPatched?: boolean; __QL_SESSION__?: string };
  if (w.__qlFetchPatched) return;
  w.__qlFetchPatched = true;
  const orig = window.fetch.bind(window);

  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    try {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      const sameOrigin = url.startsWith("/") || url.startsWith(window.location.origin);
      let tok: string | null = w.__QL_SESSION__ ?? null;
      if (!tok) {
        try {
          tok = localStorage.getItem("ql_session");
        } catch {
          tok = null;
        }
      }
      if (sameOrigin && tok) {
        const headers = new Headers(
          init?.headers ?? (input instanceof Request ? (input as Request).headers : undefined),
        );
        if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${tok}`);
        init = { ...(init ?? {}), headers };
      }
    } catch {
      /* never let the patch break a request */
    }
    return orig(input as RequestInfo, init as RequestInit);
  } as typeof fetch;
}
