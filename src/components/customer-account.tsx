"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock3, History, LogOut, MapPin, Plus, TicketCheck, UserRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { Spinner } from "@/components/spinner";
import { authHeaders } from "@/lib/authed-fetch";
import type { AccountData, CustomerTicket, CustomerUser } from "@/lib/customer-account";

const statusMeta: Record<string, { label: string; cls: string; dot?: string }> = {
  waiting: { label: "In line", cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  called: { label: "Your turn — head over", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500 live-dot" },
  serving: { label: "Being served", cls: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  holding: { label: "Action needed", cls: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-600" },
  no_show: { label: "No-show", cls: "bg-red-50 text-red-700" },
};

function relativeTime(value: Date | string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function storeToken(token: string) {
  if (typeof window === "undefined") return;
  (window as unknown as { __QL_SESSION__?: string }).__QL_SESSION__ = token;
  try {
    localStorage.setItem("ql_session", token);
  } catch {
    /* storage blocked */
  }
}

function ActiveTicketCard({ ticket }: { ticket: CustomerTicket }) {
  const [t, setT] = useState(ticket);
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: number | undefined;
    const sync = async () => {
      const r = await fetch(`/api/ticket/${ticket.publicId}`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setT((p) => ({ ...p, status: j.status, peopleAhead: j.peopleAhead, waitMinutes: j.waitMinutes }));
      }
    };
    const connect = () => {
      es = new EventSource(`/api/ticket/${ticket.publicId}/stream`);
      es.onmessage = () => sync();
      es.onerror = () => {
        try {
          es?.close();
        } catch {
          /* ignore */
        }
        retry = window.setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      try {
        es?.close();
      } catch {
        /* ignore */
      }
      if (retry) window.clearTimeout(retry);
    };
  }, [ticket.publicId]);
  const m = statusMeta[t.status] ?? statusMeta.waiting;
  return (
    <article className="rounded-2xl border border-[#e2e8e5] bg-white p-5 card-shadow transition hover:border-[#b8d7ca]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#1b2b25]">{t.establishmentName}</p>
          <p className="mt-0.5 truncate text-xs text-[#7a8782]">{t.serviceName}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${m.cls}`}>{m.dot && <span className={`size-1.5 rounded-full ${m.dot}`} />}{m.label}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#f7f9f8] px-3 py-2.5 text-center"><p className="text-lg font-bold text-[#1b2b25]">{t.peopleAhead ?? "—"}</p><p className="text-[10px] uppercase tracking-wide text-[#8a9691]">ahead</p></div>
        <div className="rounded-xl bg-[#f7f9f8] px-3 py-2.5 text-center"><p className="text-lg font-bold text-[#1b2b25]">{t.waitMinutes == null ? "—" : `~${t.waitMinutes}`}</p><p className="text-[10px] uppercase tracking-wide text-[#8a9691]">min wait</p></div>
      </div>
      <Link href={`/ticket/${t.publicId}`} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl bg-[#123e32] text-xs font-semibold text-white transition hover:bg-[#13795b]"><TicketCheck size={15} /> Open live ticket</Link>
    </article>
  );
}

function AccountView({ user, data, onLogout }: { user: CustomerUser; data: AccountData | null; onLogout: () => void }) {
  const active = data?.active ?? [];
  const history = data?.history ?? [];
  const first = user.name.split(" ")[0] || "there";
  return (
    <main className="min-h-screen bg-[#f4f7f5] pb-16">
      <header className="border-b border-[#e3e8e5] bg-white">
        <div className="mx-auto flex h-[68px] max-w-3xl items-center justify-between px-5 md:px-8">
          <Brand />
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden h-9 items-center gap-2 rounded-xl border border-[#e1e6e3] px-3 text-xs font-semibold text-[#52625c] transition hover:border-[#13795b] hover:text-[#13795b] sm:flex"><Plus size={15} /> Find a queue</Link>
            <button onClick={onLogout} className="flex h-9 items-center gap-1.5 rounded-xl border border-[#ecd9d9] bg-rose-50 px-3 text-xs font-semibold text-[#b04a4a] transition hover:bg-rose-100"><LogOut size={15} /> <span className="hidden sm:inline">Sign out</span></button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#16805e]">My queue</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-[#172721]">Hi {first} 👋</h1>
          <p className="mt-1.5 text-sm text-[#72807a]">Your saved places update live here — across any device you sign in from.</p>
        </div>

        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1b2b25]"><span className="grid size-7 place-items-center rounded-lg bg-[#e9f5ef] text-[#13795b]"><TicketCheck size={15} /></span> Right now {active.length > 0 && <span className="rounded-full bg-[#e9f5ef] px-2 py-0.5 text-[11px] font-bold text-[#13795b]">{active.length}</span>}</div>
          {active.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d8dfdb] bg-white px-6 py-10 text-center">
              <MapPin className="mx-auto text-[#9fb1a9]" />
              <p className="mt-3 text-sm font-semibold text-[#33433d]">You’re not in any queue right now</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-[#7a8782]">Join a queue and it’ll be saved to your account and tracked live.</p>
              <Link href="/" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#123e32] px-4 text-xs font-semibold text-white transition hover:bg-[#13795b]"><Plus size={15} /> Find a queue</Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {active.map((t) => (
                <ActiveTicketCard key={t.id} ticket={t} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-9">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1b2b25]"><span className="grid size-7 place-items-center rounded-lg bg-[#eef1ef] text-[#5a6862]"><History size={15} /></span> History</div>
          {history.length === 0 ? (
            <p className="rounded-2xl border border-[#e2e8e5] bg-white px-5 py-6 text-center text-xs text-[#8a9691]">No past visits yet — your completed and cancelled visits will show up here.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#e2e8e5] bg-white">
              {history.map((t, i) => {
                const m = statusMeta[t.status] ?? statusMeta.completed;
                return (
                  <div key={t.id} className={`flex items-center gap-3 px-5 py-3.5 ${i > 0 ? "border-t border-[#f0f2f1]" : ""}`}>
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full ${m.cls}`}><Clock3 size={14} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[#1b2b25]">{t.establishmentName}</p>
                      <p className="truncate text-[11px] text-[#8a9691]">{t.serviceName} · {relativeTime(t.updatedAt)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${m.cls}`}>{m.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CustomerAuth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const url = mode === "login" ? "/api/auth/login" : "/api/auth/signup/customer";
    const payload =
      mode === "login"
        ? { email: form.get("email"), password: form.get("password") }
        : { name: form.get("name"), email: form.get("email"), password: form.get("password") };
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      if (json.token) storeToken(json.token);
      window.location.replace(`/account?session=${encodeURIComponent(json.token ?? "")}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      setLoading(false);
    }
  }

  const field = "mt-1.5 h-11 w-full rounded-xl border border-[#dce3df] px-3.5 text-sm outline-none focus:border-[#4b947b]";
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#0d2f27] px-12 py-10 text-white lg:flex lg:flex-col">
        <div className="absolute -left-40 -top-40 size-[460px] rounded-full bg-[#2c8a6d]/25 blur-3xl" />
        <div className="absolute -bottom-44 right-0 size-80 rounded-full bg-[#7ad2aa]/15 blur-3xl" />
        <div className="relative"><Brand light /></div>
        <div className="relative my-auto max-w-md">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium"><UserRound size={14} /> Your queue, saved</p>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-.05em] xl:text-5xl">Pick up right where you left off.</h1>
          <p className="mt-5 text-sm leading-6 text-white/65">Sign in and every queue you join is saved to your profile — live status and history, on any device.</p>
        </div>
      </section>

      <section className="flex min-h-screen flex-col bg-white px-5 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden"><Brand /></div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-[#66736e] transition hover:text-[#13795b]"><MapPin size={15} /> Find a queue</Link>
        </div>
        <div className="mx-auto my-auto w-full max-w-[420px] py-10">
          <div className="mb-6 inline-flex rounded-xl bg-[#f1f4f2] p-1 text-xs font-semibold">
            <button type="button" onClick={() => setMode("login")} className={`rounded-lg px-4 py-2 transition ${mode === "login" ? "bg-white text-[#13795b] shadow-sm" : "text-[#64726d]"}`}>Sign in</button>
            <button type="button" onClick={() => setMode("signup")} className={`rounded-lg px-4 py-2 transition ${mode === "signup" ? "bg-white text-[#13795b] shadow-sm" : "text-[#64726d]"}`}>Create account</button>
          </div>
          <h2 className="text-2xl font-semibold tracking-[-.03em] text-[#162720]">{mode === "login" ? "Welcome back" : "Create your profile"}</h2>
          <p className="mt-1.5 text-sm text-[#74817c]">{mode === "login" ? "Sign in to see your saved queues." : "Save your place in any queue to your profile."}</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && <label className="block text-xs font-semibold text-[#465650]">Full name<input name="name" required placeholder="e.g. Alex Morgan" className={field} /></label>}
            <label className="block text-xs font-semibold text-[#465650]">Email<input name="email" type="email" required placeholder="you@example.com" className={field} /></label>
            <label className="block text-xs font-semibold text-[#465650]">Password<input name="password" type="password" required minLength={6} placeholder="At least 6 characters" className={field} /></label>
            {error && <p className="rounded-xl bg-red-50 px-3.5 py-3 text-xs font-medium text-red-700">{error}</p>}
            <button disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#13795b] text-sm font-bold text-white transition hover:bg-[#0f684e] disabled:opacity-60">{loading ? <><Spinner /> Please wait…</> : mode === "login" ? "Sign in" : "Create account"}</button>
          </form>
          <p className="mt-4 text-center text-[11px] text-[#89948f]">{mode === "login" ? "New here? " : "Already have an account? "}<button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="font-semibold text-[#13795b] hover:underline">{mode === "login" ? "Create an account" : "Sign in instead"}</button></p>
        </div>
      </section>
    </main>
  );
}

export function CustomerAccount({
  initialUser,
  initial,
  initialToken,
}: {
  initialUser: CustomerUser | null;
  initial: AccountData | null;
  initialToken?: string;
}) {
  const [user, setUser] = useState<CustomerUser | null>(initialUser);
  const [data, setData] = useState<AccountData | null>(initial);
  const [phase, setPhase] = useState<"ready" | "checking" | "auth">(initialUser ? "ready" : "checking");

  useEffect(() => {
    if (initialToken && typeof window !== "undefined") storeToken(initialToken);
  }, [initialToken]);

  useEffect(() => {
    if (initialUser) return;
    (async () => {
      const res = await fetch("/api/account", { credentials: "include", headers: authHeaders() });
      if (res.ok) {
        const j = await res.json();
        setUser(j.user);
        setData(j);
        setPhase("ready");
      } else {
        setPhase("auth");
      }
    })();
  }, [initialUser]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include", headers: authHeaders() });
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined") {
      (window as unknown as { __QL_SESSION__?: string }).__QL_SESSION__ = undefined;
      try {
        localStorage.removeItem("ql_session");
      } catch {
        /* ignore */
      }
      window.location.href = "/account";
    }
  }

  if (phase === "auth") return <CustomerAuth />;
  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f7f5]">
        <Spinner />
      </div>
    );
  }
  return <AccountView user={user} data={data} onLogout={logout} />;
}
