"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Check, Clock3, Eye, EyeOff, LocateFixed, MapPin, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { Spinner } from "@/components/spinner";
import { CATEGORIES, CATEGORY_COLORS, type CategoryId } from "@/lib/categories";
import { MALAYSIA_STATES } from "@/lib/malaysia-states";

const field = "focus-ring mt-2 h-12 w-full rounded-xl border border-[#dbe2de] bg-white px-4 text-sm outline-none transition focus:border-[#3a8e72]";

export function SignupForm() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<CategoryId | "">("");
  const [state, setState] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [geo, setGeo] = useState<"idle" | "loading" | "ok" | "err">("idle");

  function useMyLocation() {
    setGeo("loading");
    if (!navigator.geolocation) { setGeo("err"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setLatitude(p.coords.latitude.toFixed(7)); setLongitude(p.coords.longitude.toFixed(7)); setGeo("ok"); },
      () => setGeo("err"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      ownerName: form.get("ownerName"),
      email: form.get("email"),
      password: form.get("password"),
      businessName: form.get("businessName"),
      address: form.get("address"),
      phone: form.get("phone"),
      openingTime: form.get("openingTime"),
      closingTime: form.get("closingTime"),
      category,
      state,
      latitude: latitude.trim() === "" ? null : Number(latitude),
      longitude: longitude.trim() === "" ? null : Number(longitude),
    };
    try {
      const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      const isJSON = contentType.includes("application/json");
      if (!response.ok) {
        let message = `The sign-up service responded with status ${response.status}.`;
        if (isJSON) { try { message = JSON.parse(text).error || message; } catch { /* not JSON after all */ } }
        else message = "We couldn’t reach the sign-up service. This usually means the preview link is stale or opened inside an embed — open the latest preview in a new tab and try again.";
        throw new Error(message);
      }
      if (!isJSON) {
        throw new Error("The sign-up service returned a web page instead of a response. Open the latest preview link in a new tab (not embedded) and try again.");
      }
      let token = "";
      try { token = (JSON.parse(text) as { token?: string }).token || ""; } catch { /* token optional */ }
      try { if (token) localStorage.setItem("ql_session", token); } catch { /* storage blocked */ }
      if (token && typeof window !== "undefined") (window as unknown as { __QL_SESSION__?: string }).__QL_SESSION__ = token;
      window.location.replace(token ? `/dashboard?session=${encodeURIComponent(token)}` : "/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t create your account.");
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[0.95fr_1.05fr]">
      <section className="relative hidden overflow-hidden bg-[#0d2f27] px-12 py-10 text-white lg:flex lg:flex-col">
        <div className="absolute -left-40 -top-48 size-[520px] rounded-full bg-[#2c8a6d]/25 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 size-[450px] rounded-full bg-[#7ad2aa]/15 blur-3xl" />
        <div className="absolute right-10 top-1/2 size-72 -translate-y-1/2 rounded-full border border-white/10 bg-white/[.04] blur-2xl" />
        <div className="relative"><Brand light /></div>
        <div className="relative my-auto max-w-xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium"><Sparkles size={14} /> Onboard in under a minute</p>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-.055em] xl:text-6xl">Your queue.<br /><span className="text-[#91dfbd]">Your rules.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/65">Claim your establishment, set your services, and start seating walk‑ins and remote joiners from a single calm dashboard.</p>
          <div className="mt-9 space-y-3">
            {[
              [Building2, "Your listing goes live", "Customers in your state see you the moment you sign up."],
              [Users, "Remote + walk‑in", "Manage GPS joiners and desk walk‑ins side by side."],
              [Clock3, "Pause anytime", "Stop new joins with one tap when you’re at capacity."],
            ].map(([Icon, title, copy]) => {
              const FeatureIcon = Icon as typeof Users;
              return (
                <div key={String(title)} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[.06] p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#91dfbd]"><FeatureIcon size={17} /></span>
                  <div><p className="text-sm font-semibold">{String(title)}</p><p className="mt-0.5 text-xs leading-5 text-white/55">{String(copy)}</p></div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="relative text-xs text-white/35">No card required · cancel your queue anytime.</p>
      </section>

      <section className="flex min-h-screen flex-col bg-white px-5 py-6 sm:px-10 lg:px-14 xl:px-20">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden"><Brand /></div>
          <Link href="/login" className="btnlink border border-[#dce3df] bg-white text-[#53625d] transition hover:border-[#13795b] hover:text-[#13795b]"><ArrowLeft size={13} /> Sign in instead</Link>
        </div>
        <div className="mx-auto my-auto w-full max-w-[560px] py-10">
          <p className="text-xs font-bold uppercase tracking-[.15em] text-[#16805e]">Create your dashboard</p>
          <h2 className="mt-3 text-[30px] font-semibold tracking-[-.045em] text-[#162720] sm:text-[34px]">Put your business on the map</h2>
          <p className="mt-2 text-sm leading-6 text-[#74817c]">One account for your owner login, plus your establishment and its queue services.</p>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <div className="rounded-2xl border border-[#e6ebe8] bg-[#fafbfa] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#16805e]">Owner account</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[#465650]">Your name<input name="ownerName" required autoComplete="name" placeholder="e.g. Maya Chen" className={field} /></label>
                <label className="block text-xs font-semibold text-[#465650]">Email<input name="email" type="email" required autoComplete="email" placeholder="you@business.com" className={field} /></label>
              </div>
              <label className="mt-4 block text-xs font-semibold text-[#465650]">Password<div className="relative mt-2"><input name="password" type={visible ? "text" : "password"} required minLength={6} autoComplete="new-password" placeholder="At least 6 characters" className="focus-ring h-12 w-full rounded-xl border border-[#dbe2de] bg-white px-4 pr-12 text-sm outline-none transition focus:border-[#3a8e72]" /><button type="button" onClick={() => setVisible(!visible)} className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-lg text-[#7a8782] hover:bg-[#f1f4f2]" aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            </div>

            <div className="rounded-2xl border border-[#e6ebe8] bg-[#fafbfa] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#16805e]">Establishment</p>
              <label className="mt-3 block text-xs font-semibold text-[#465650]">Business name<input name="businessName" required placeholder="e.g. Harbour Family Clinic" className={field} /></label>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[#465650]">Category
                  <select required value={category} onChange={(e) => setCategory(e.target.value as CategoryId | "")} className={`${field} appearance-none bg-[length:1rem] bg-[right_0.9rem_center] bg-no-repeat pr-9`} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%237a8782' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
                    <option value="">Select…</option>
                    {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-[#465650]">State
                  <select required value={state} onChange={(e) => setState(e.target.value)} className={`${field} appearance-none bg-[length:1rem] bg-[right_0.9rem_center] bg-no-repeat pr-9`} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%237a8782' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
                    <option value="">Select…</option>
                    {MALAYSIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <label className="mt-4 block text-xs font-semibold text-[#465650]">Street address<input name="address" required placeholder="No. 12, Jalan …, postcode, city" className={field} /></label>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-[#465650]">Latitude <span className="font-normal text-[#9aa49f]">(optional)</span><input value={latitude} onChange={(e) => setLatitude(e.target.value)} type="number" step="any" placeholder="Auto from address" className={field} /></label>
                <label className="block text-xs font-semibold text-[#465650]">Longitude <span className="font-normal text-[#9aa49f]">(optional)</span><input value={longitude} onChange={(e) => setLongitude(e.target.value)} type="number" step="any" placeholder="Auto from address" className={field} /></label>
              </div>
              <button type="button" onClick={useMyLocation} className="focus-ring mt-3 inline-flex h-9 items-center gap-2 rounded-xl border border-[#dfe5e2] bg-white px-3 text-[11px] font-bold text-[#465650] transition hover:border-[#13795b] hover:text-[#13795b]">
                {geo === "loading" ? <Spinner /> : <LocateFixed size={14} className={geo === "ok" ? "text-[#13795b]" : ""} />}
                {geo === "ok" ? "Location captured" : geo === "err" ? "Couldn’t read GPS — enter manually" : "Use my current location"}
              </button>
              <p className="mt-2 text-[11px] leading-4 text-[#89948f]">No coordinates? Leave them blank — we’ll pinpoint your address automatically, or tap the button to drop a GPS pin.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="block text-xs font-semibold text-[#465650]">Phone<input name="phone" type="tel" placeholder="+60 …" className={field} /></label>
                <label className="block text-xs font-semibold text-[#465650]">Opens<input name="openingTime" type="time" defaultValue="08:00" className={field} /></label>
                <label className="block text-xs font-semibold text-[#465650]">Closes<input name="closingTime" type="time" defaultValue="18:00" className={field} /></label>
              </div>
            </div>

            {category && (
              <div className="flex items-center gap-2 rounded-xl bg-[#eff9f4] px-3.5 py-2.5 text-[11px] text-[#176348]">
                <Check size={14} /> We’ll set up {CATEGORIES.find((c) => c.id === category)?.label} queue services automatically.
              </div>
            )}

            {error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}
            <button disabled={loading} className="focus-ring flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#13795b] text-sm font-bold text-white shadow-[0_8px_20px_rgba(19,121,91,.18)] transition hover:bg-[#0e684e] disabled:opacity-60">{loading ? <><Spinner /> Creating your dashboard…</> : <>Create my dashboard <ArrowRight size={16} /></>}</button>
            <div className="flex items-center justify-center gap-2 text-[11px] text-[#89948f]"><ShieldCheck size={13} /> Your data is encrypted · you can delete your account anytime</div>
          </form>
        </div>
      </section>
    </main>
  );
}
