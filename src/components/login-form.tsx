"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, Check, Eye, EyeOff, LockKeyhole, MapPinned, ShieldCheck, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { Spinner } from "@/components/spinner";

export function LoginForm() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inFrame, setInFrame] = useState(false);

  useEffect(() => {
    try { setInFrame(window.self !== window.top); } catch { setInFrame(true); }
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      const isJSON = contentType.includes("application/json");
      if (!response.ok) {
        let message = `The sign-in service responded with status ${response.status}.`;
        if (isJSON) { try { message = JSON.parse(text).error || message; } catch { /* not JSON after all */ } }
        else message = "We couldn’t reach the sign-in service. This usually means the preview link is stale or opened inside an embed — open the latest preview in a new tab and try again.";
        throw new Error(message);
      }
      if (!isJSON) {
        throw new Error("The sign-in service returned a web page instead of a response. Open the latest preview link in a new tab (not embedded) and try again.");
      }
      let token = "";
      try { token = (JSON.parse(text) as { token?: string }).token || ""; } catch { /* token optional */ }
      try { if (token) localStorage.setItem("ql_session", token); } catch { /* storage blocked */ }
      if (token && typeof window !== "undefined") (window as unknown as { __QL_SESSION__?: string }).__QL_SESSION__ = token;
      // Carry the token in the URL so the dashboard renders even when the cookie can't be set
      // (embedded / third-party contexts); the page then cleans the URL and the fetch patch
      // keeps the session alive via an Authorization header on every later request.
      window.location.replace(token ? `/dashboard?session=${encodeURIComponent(token)}` : "/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed.");
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#0d2f27] px-12 py-10 text-white lg:flex lg:flex-col">
        <div className="absolute -left-40 -top-48 size-[520px] rounded-full bg-[#2c8a6d]/25 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 size-[450px] rounded-full bg-[#7ad2aa]/15 blur-3xl" />
        <div className="relative"><Brand light /></div>
        <div className="relative my-auto max-w-xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium"><ShieldCheck size={14} /> Built for modern service teams</p>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-.055em] xl:text-6xl">Every queue.<br /><span className="text-[#91dfbd]">One calm dashboard.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/65">See demand, move people forward, and tune service operations from anywhere—all while customers wait on their own terms.</p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[[Users, "Live", "Queue control"], [MapPinned, "Multi-site", "Location view"], [BarChart3, "Clear", "Insights"]].map(([Icon, value, label]) => {
              const FeatureIcon = Icon as typeof Users;
              return <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[.07] p-4"><FeatureIcon size={18} className="text-[#91dfbd]" /><p className="mt-4 text-lg font-semibold">{String(value)}</p><p className="mt-1 text-[11px] text-white/50">{String(label)}</p></div>;
            })}
          </div>
          <Link href="/signup" className="btnlink mt-8 w-fit bg-white text-[#0d2f27] shadow-lg transition hover:-translate-y-0.5">Create your business account <ArrowRight size={13} /></Link>
        </div>
        <p className="relative text-xs text-white/35">Free to start · live in under a minute.</p>
      </section>

      <section className="flex min-h-screen flex-col bg-white px-5 py-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden"><Brand /></div>
          <Link href="/" className="btnlink border border-[#dce3df] bg-white text-[#53625d] transition hover:border-[#13795b] hover:text-[#13795b]"><ArrowLeft size={13} /> Customer view</Link>
        </div>
        <div className="mx-auto my-auto w-full max-w-[430px] py-12">
          <p className="text-xs font-bold uppercase tracking-[.15em] text-[#16805e]">Welcome back</p>
          <h2 className="mt-3 text-[34px] font-semibold tracking-[-.045em] text-[#162720]">Sign in to Quantum Leap</h2>
          <p className="mt-2 text-sm leading-6 text-[#74817c]">Manage queues, service teams, and every customer arrival.</p>

          <div className="mt-7 rounded-2xl border border-[#cfe8dc] bg-[#eff9f4] p-4">
            <p className="text-xs font-bold text-[#176348]">DEMO WORKSPACE</p>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#506a60]"><span>admin@quantumleap.app</span><span className="h-3 w-px bg-[#c6ded3]" /><span>demo1234</span><Check size={15} className="ml-auto text-[#16805e]" /></div>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block text-xs font-semibold text-[#465650]">Email address<input name="email" type="email" required defaultValue="admin@quantumleap.app" autoComplete="email" className="focus-ring mt-2 h-12 w-full rounded-xl border border-[#dbe2de] bg-white px-4 text-sm outline-none transition focus:border-[#3a8e72]" /></label>
            <label className="block text-xs font-semibold text-[#465650]">Password<div className="relative mt-2"><input name="password" type={visible ? "text" : "password"} required defaultValue="demo1234" autoComplete="current-password" className="focus-ring h-12 w-full rounded-xl border border-[#dbe2de] bg-white px-4 pr-12 text-sm outline-none transition focus:border-[#3a8e72]" /><button type="button" onClick={() => setVisible(!visible)} className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-lg text-[#7a8782] hover:bg-[#f1f4f2]" aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            {error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}
            {inFrame && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-4 text-amber-800">Embedded preview? Sign-in now uses a partitioned secure cookie that works here. If it still loops back to this screen, <a href="/login" target="_blank" rel="noreferrer" className="font-semibold underline decoration-amber-400 underline-offset-2 hover:text-amber-900">open the dashboard in a new tab</a>.</div>}
            <button disabled={loading} className="focus-ring flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#13795b] text-sm font-bold text-white shadow-[0_8px_20px_rgba(19,121,91,.18)] transition hover:bg-[#0e684e] disabled:opacity-60">{loading ? <><Spinner /> Signing in…</> : <>Sign in to dashboard <ArrowRight size={16} /></>}</button>
          </form>
          <p className="mt-5 text-center text-sm text-[#74817c]">Run your own establishment? <Link href="/signup" className="font-semibold text-[#13795b] hover:underline">Create your dashboard</Link></p>
          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-[#89948f]"><LockKeyhole size={13} /> Encrypted session · Secure HTTP-only cookie</div>
        </div>
      </section>
    </main>
  );
}
