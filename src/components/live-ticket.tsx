"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Check, ChevronRight, Clock3, Home, MapPin, MapPinOff, Navigation, RefreshCw, Repeat, Route, ShieldCheck, TicketCheck, UserRound, Users, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { Spinner } from "@/components/spinner";

type TicketData = {
  id: number;
  publicId: string;
  ticketNumber: string;
  customerName: string;
  status: string;
  joinedAt: Date | string;
  updatedAt: Date | string;
  travelMinutes: number;
  distanceKm: string | null;
  originLatitude: string | null;
  originLongitude: string | null;
  serviceMinutesSnapshot: number;
  establishmentName: string;
  address: string;
  latitude: string;
  longitude: string;
  serviceName: string;
  peopleAhead: number;
  waitMinutes: number;
  leaveInMinutes: number;
  estimatedServiceAt: string;
  requeuedAt: Date | string | null;
  previousNumber: string | null;
};

const statusCopy: Record<string, { label: string; title: string; subtitle: string; color: string }> = {
  waiting: { label: "You’re in line", title: "Your place is saved", subtitle: "We’ll keep timing your arrival as the line moves.", color: "bg-emerald-50 text-emerald-700" },
  called: { label: "It’s your turn", title: "Please head to the desk", subtitle: "The team is ready for you now.", color: "bg-amber-50 text-amber-700" },
  serving: { label: "Now serving", title: "You’re being helped", subtitle: "Your wait is officially over.", color: "bg-blue-50 text-blue-700" },
  completed: { label: "Visit complete", title: "Thanks for using Quantum Leap", subtitle: "We hope you enjoyed having your time back.", color: "bg-slate-100 text-slate-700" },
  cancelled: { label: "Cancelled", title: "You left the queue", subtitle: "You can find another queue whenever you’re ready.", color: "bg-red-50 text-red-700" },
  no_show: { label: "Place released", title: "This visit has ended", subtitle: "Join again if you still need service.", color: "bg-red-50 text-red-700" },
  holding: { label: "Action needed", title: "We need a quick decision", subtitle: "Our last check didn’t place you at the venue and your turn is close. Choose a new number or cancel below.", color: "bg-amber-50 text-amber-800" },
};

export function LiveTicket({ initialTicket }: { initialTicket: TicketData }) {
  const [ticket, setTicket] = useState(initialTicket);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const lastRequeueRef = useRef<string | null>(initialTicket.requeuedAt ? String(initialTicket.requeuedAt) : null);
  const [requeueNotice, setRequeueNotice] = useState<{ newNum: string; prev: string | null } | null>(null);
  const [deciding, setDeciding] = useState<null | "renumber" | "cancel">(null);
  const [error, setError] = useState("");
  const prevStatusRef = useRef(ticket.status);
  const copy = statusCopy[ticket.status] ?? statusCopy.waiting;
  const active = ["waiting", "called", "serving"].includes(ticket.status);
  const [notifStatus, setNotifStatus] = useState<"idle" | "granted" | "denied" | "unsupported">(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission === "granted" ? "granted" : "idle",
  );
  const [toast, setToast] = useState<{ id: number; title: string; body: string; tone: "emerald" | "amber" | "blue" } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);
  const notify = (title: string, body: string, tone: "emerald" | "amber" | "blue" = "emerald") => {
    setToast({ id: Date.now(), title, body, tone });
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch {
        /* ignore */
      }
    }
  };

  async function refresh(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch(`/api/ticket/${ticket.publicId}`, { cache: "no-store" });
      if (response.ok) {
        const next = await response.json();
        if (next.requeuedAt && next.requeuedAt !== lastRequeueRef.current) {
          lastRequeueRef.current = next.requeuedAt;
          setRequeueNotice({ newNum: next.ticketNumber, prev: next.previousNumber ?? null });
          notify("Your queue number changed", `You’ve been moved to ${next.ticketNumber}${next.previousNumber ? ` (was ${next.previousNumber})` : ""}.`, "amber");
        }
        if (next.status === "holding" && prevStatusRef.current !== "holding") {
          notify("Action needed at " + next.establishmentName, "Your turn is close but we can’t see you at the venue. Choose a new number or cancel.", "amber");
        }
        prevStatusRef.current = next.status;
        if (ticket.status === "waiting" && next.status === "called") {
          notify("It’s your turn", `${next.establishmentName} is ready for you.`, "amber");
        }
        setTicket(next);
        setLastUpdated(new Date());
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  useEffect(() => {
    localStorage.setItem("quantum_leap_active_ticket", ticket.publicId);
    const timer = window.setInterval(() => refresh(true), 5_000);
    return () => window.clearInterval(timer);
  }, [ticket.publicId, ticket.status]);

  // Real-time: the server pushes the instant this ticket's queue changes (e.g. the admin
  // calls next), so the customer sees "it's your turn" / a new number without waiting.
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: number | undefined;
    const connect = () => {
      es = new EventSource(`/api/ticket/${ticket.publicId}/stream`);
      es.onmessage = () => refresh(true);
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

  // While waiting, ping the current GPS so the server can auto-reschedule us ~5 min before
  // our turn if we're not within 100m of the venue.
  useEffect(() => {
    if ((ticket.status !== "waiting" && ticket.status !== "holding") || typeof navigator === "undefined" || !navigator.geolocation) return;
    const send = () => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          fetch(`/api/ticket/${ticket.publicId}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
      );
    };
    send();
    const t = window.setInterval(send, 20_000);
    return () => window.clearInterval(t);
  }, [ticket.publicId, ticket.status]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      setNotifStatus("unsupported");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      const granted = permission === "granted";
      setNotifStatus(granted ? "granted" : "denied");
      if (granted) notify("Notifications enabled", "We’ll ping this device when your turn is close.", "emerald");
    } catch {
      setNotifStatus("denied");
    }
  }

  async function cancelTicket() {
    setCancelling(true);
    const response = await fetch(`/api/ticket/${ticket.publicId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
    if (response.ok) {
      localStorage.removeItem("quantum_leap_active_ticket");
      setTicket((current) => ({ ...current, status: "cancelled" }));
      setConfirmCancel(false);
    }
    setCancelling(false);
  }

  async function decide(choice: "renumber" | "cancel") {
    setDeciding(choice);
    setError("");
    try {
      const res = await fetch(`/api/ticket/${ticket.publicId}/decide`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice }) });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Couldn’t update your ticket."); }
      setDeciding(null);
      await refresh(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t reach the server.");
      setDeciding(null);
    }
  }

  const serviceTime = new Date(ticket.estimatedServiceAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const joinedTime = new Date(ticket.joinedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const destination = `${ticket.latitude},${ticket.longitude}`;
  const directionsUrl = ticket.originLatitude && ticket.originLongitude
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(`${ticket.originLatitude},${ticket.originLongitude};${destination}`)}`
    : `https://www.openstreetmap.org/?mlat=${ticket.latitude}&mlon=${ticket.longitude}#map=16/${ticket.latitude}/${ticket.longitude}`;

  return (
    <main className="min-h-screen bg-[#f4f7f5] pb-10">
      {toast && (
        <div className="fixed left-1/2 top-4 z-[60] w-[min(92vw,24rem)] -translate-x-1/2 animate-fade-up">
          <div className={`flex items-start gap-3 rounded-2xl border p-4 shadow-[0_18px_45px_rgba(18,35,30,.18)] ${toast.tone === "amber" ? "border-amber-300 bg-amber-50" : toast.tone === "blue" ? "border-blue-300 bg-blue-50" : "border-emerald-300 bg-emerald-50"}`}>
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-white ${toast.tone === "amber" ? "text-amber-600" : toast.tone === "blue" ? "text-blue-600" : "text-emerald-600"}`}><BellRing size={18} /></span>
            <div className="min-w-0 flex-1"><p className={`text-sm font-semibold ${toast.tone === "amber" ? "text-amber-900" : toast.tone === "blue" ? "text-blue-900" : "text-emerald-900"}`}>{toast.title}</p><p className={`mt-0.5 text-xs leading-5 ${toast.tone === "amber" ? "text-amber-800" : toast.tone === "blue" ? "text-blue-800" : "text-emerald-800"}`}>{toast.body}</p></div>
            <button onClick={() => setToast(null)} className={`grid size-7 shrink-0 place-items-center rounded-lg transition ${toast.tone === "amber" ? "text-amber-700 hover:bg-amber-100" : toast.tone === "blue" ? "text-blue-700 hover:bg-blue-100" : "text-emerald-700 hover:bg-emerald-100"}`} aria-label="Dismiss"><X size={15} /></button>
          </div>
        </div>
      )}
      <header className="border-b border-[#e3e8e5] bg-white">
        <div className="mx-auto flex h-[68px] max-w-5xl items-center justify-between px-5 md:px-8">
          <Brand />
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-[#e1e6e3] px-3.5 py-2.5 text-xs font-semibold text-[#52625c] transition hover:border-[#a9c6bb]"><Home size={15} /> <span className="hidden sm:inline">Find another queue</span></Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-10">
        <div className="mb-5 flex items-center justify-between">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${copy.color}`}><span className={`relative size-2 rounded-full ${ticket.status === "waiting" ? "bg-green-500 live-dot" : "bg-current"}`} />{copy.label}</div>
          <button onClick={() => refresh()} disabled={refreshing} className="flex items-center gap-2 text-[11px] font-medium text-[#7a8782]"><RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Updated {Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000))}s ago</button>
        </div>

        {requeueNotice && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 animate-fade-up">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-amber-600"><Repeat size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">Your queue number changed to {requeueNotice.newNum}</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">You weren’t within 100 m of the venue 5 minutes before your turn, so we moved you to the back of the queue instead of cancelling{requeueNotice.prev ? ` (you were ${requeueNotice.prev})` : ""}. Head over when you’re ready.</p>
            </div>
            <button onClick={() => setRequeueNotice(null)} className="grid size-7 shrink-0 place-items-center rounded-lg text-amber-700 transition hover:bg-amber-100" aria-label="Dismiss"><X size={15} /></button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <section className="overflow-hidden rounded-[24px] border border-[#dfe6e2] bg-white card-shadow">
            <div className={`px-5 py-8 text-center sm:px-8 sm:py-10 ${ticket.status === "called" ? "bg-amber-50" : ticket.status === "serving" ? "bg-blue-50" : ticket.status === "completed" ? "bg-slate-50" : "bg-[#ebf7f1]"} ${requeueNotice || ticket.status === "holding" ? "ring-4 ring-amber-300" : ""}`}>
              <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#678078]">Your queue number</p>
              <p className="mt-3 text-[72px] font-bold leading-none tracking-[-.07em] text-[#124a39] sm:text-[88px]">{ticket.ticketNumber}</p>
              <h1 className="mt-6 text-xl font-semibold tracking-[-.03em]">{copy.title}</h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718079]">{copy.subtitle}</p>
            </div>

            {active && (
              <div className="grid grid-cols-3 divide-x divide-[#e7ece9] border-y border-[#e7ece9]">
                <div className="px-2 py-5 text-center"><Users size={17} className="mx-auto text-[#16805e]" /><p className="mt-2 text-xl font-bold">{ticket.peopleAhead}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-[#8b9692]">ahead</p></div>
                <div className="px-2 py-5 text-center"><Clock3 size={17} className="mx-auto text-[#16805e]" /><p className="mt-2 text-xl font-bold">{ticket.waitMinutes === 0 ? "Now" : `~${ticket.waitMinutes}`}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-[#8b9692]">min wait</p></div>
                <div className="px-2 py-5 text-center"><Navigation size={17} className="mx-auto text-[#16805e]" /><p className="mt-2 text-xl font-bold">{ticket.travelMinutes || "—"}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-[#8b9692]">min travel</p></div>
              </div>
            )}

            {ticket.status === "holding" && (
              <div className="border-b border-amber-200 bg-amber-50 p-5 sm:p-7">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-amber-600"><MapPinOff size={20} /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-900">We can’t see you at the venue</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">Your turn is approaching but our last location check didn’t place you within 100 m. To keep the line fair for everyone, choose what to do next — you won’t be cancelled without your say.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button disabled={deciding !== null} onClick={() => decide("renumber")} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#13795b] px-3 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0f684e] active:scale-[0.98] disabled:opacity-60">{deciding === "renumber" ? <Spinner /> : <RefreshCw size={14} />}{deciding === "renumber" ? "Getting new number…" : "Get a new number"}</button>
                  <button disabled={deciding !== null} onClick={() => decide("cancel")} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-60">{deciding === "cancel" ? <Spinner /> : <X size={14} />}{deciding === "cancel" ? "Cancelling…" : "Cancel my spot"}</button>
                </div>
                {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
              </div>
            )}

            <div className="p-5 sm:p-7">
              {ticket.status === "waiting" && (
                <div className={`flex items-center gap-4 rounded-2xl p-4 ${ticket.leaveInMinutes <= 2 ? "bg-amber-50" : "bg-[#f1f8f5]"}`}>
                  <span className={`grid size-11 shrink-0 place-items-center rounded-xl bg-white ${ticket.leaveInMinutes <= 2 ? "text-amber-700" : "text-[#13795b]"}`}><Navigation size={20} /></span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{ticket.leaveInMinutes <= 2 ? "It’s time to head out" : `Leave in about ${ticket.leaveInMinutes} min`}</p><p className="mt-1 truncate text-xs text-[#75847e]">Expected service around {serviceTime}</p></div>
                  <a href={directionsUrl} target="_blank" rel="noreferrer" className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#13795b]"><ChevronRight size={17} /></a>
                </div>
              )}

              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f1f4f2] text-[#66756f]"><MapPin size={16} /></span><div><p className="text-sm font-semibold">{ticket.establishmentName}</p><p className="mt-1 text-xs leading-5 text-[#7a8782]">{ticket.address}</p></div></div>
                <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f1f4f2] text-[#66756f]"><TicketCheck size={16} /></span><div><p className="text-sm font-semibold">{ticket.serviceName}</p><p className="mt-1 text-xs text-[#7a8782]">Joined at {joinedTime} · {ticket.distanceKm ? `${ticket.distanceKm} km away` : "Remote join"}</p></div></div>
                <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f1f4f2] text-[#66756f]"><UserRound size={16} /></span><div><p className="text-sm font-semibold">{ticket.customerName}</p><p className="mt-1 text-xs text-[#7a8782]">Show this screen when you arrive</p></div></div>
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="overflow-hidden rounded-[22px] border border-[#dfe6e2] bg-white card-shadow">
              <div className="relative h-48 overflow-hidden bg-[#e8f0eb]">
                <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(#c7d6ce 1px, transparent 1px), linear-gradient(90deg, #c7d6ce 1px, transparent 1px)", backgroundSize: "28px 28px", transform: "rotate(8deg) scale(1.2)" }} />
                <div className="absolute left-[18%] top-[65%] size-3 rounded-full border-2 border-white bg-[#405c52] shadow" />
                <div className="absolute left-[22%] top-[56%] h-1 w-[48%] -rotate-[18deg] rounded-full bg-[#55a888]" />
                <div className="absolute right-[24%] top-[31%] grid size-10 place-items-center rounded-full border-4 border-white bg-[#13795b] text-white shadow-lg"><MapPin size={18} /></div>
                <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-xl bg-white/90 px-3 py-2.5 backdrop-blur"><span className="text-xs font-semibold">{ticket.travelMinutes ? `${ticket.travelMinutes} min drive` : "Directions ready"}</span><span className="text-[10px] text-[#77847f]">LIVE ROUTE</span></div>
              </div>
              <a href={directionsUrl} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 border-t border-[#e7ece9] text-sm font-semibold text-[#13795b] transition hover:bg-[#f4faf7]"><Route size={16} /> Open directions</a>
            </div>

            {active && (
              <div className="rounded-[22px] border border-[#dfe6e2] bg-white p-5 card-shadow">
                <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf7f2] text-[#13795b]">{notifStatus === "granted" ? <BellRing size={18} /> : <Bell size={18} />}</span><div><p className="text-sm font-semibold">{notifStatus === "granted" ? "Alerts are on" : "Queue alerts"}</p><p className="mt-1 text-xs leading-5 text-[#7b8883]">{notifStatus === "granted" ? "We’ll ping this device when your turn is close." : notifStatus === "denied" || notifStatus === "unsupported" ? "Your browser blocked pop-up alerts — on-screen alerts here are always on." : "On-screen alerts here are always on. Enable pop-ups for background alerts too."}</p></div></div>
                {notifStatus === "granted" ? (
                  <div className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#edf7f2] text-xs font-semibold text-[#13795b]"><Check size={15} /> Background alerts enabled</div>
                ) : (
                  <button onClick={enableNotifications} className="mt-4 h-10 w-full rounded-xl border border-[#dce4e0] text-xs font-semibold text-[#43534d] transition hover:border-[#9ebfb2] hover:bg-[#f4faf7] active:scale-[0.98]">Enable background alerts</button>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-[11px] text-[#7f8b86]"><ShieldCheck size={14} className="text-[#16805e]" /> This page refreshes automatically every 15 seconds.</div>
            {active && <button onClick={() => setConfirmCancel(true)} className="flex w-full items-center justify-center gap-2 py-2 text-xs font-medium text-[#8a4d4d] hover:text-red-700"><X size={14} /> Leave this queue</button>}
          </aside>
        </div>
      </div>

      {confirmCancel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#10281f]/50 p-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center soft-shadow"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600"><X size={21} /></span><h2 className="mt-4 text-lg font-semibold">Leave the queue?</h2><p className="mt-2 text-sm leading-6 text-[#75817c]">Your place will be released and can’t be restored.</p><div className="mt-6 grid grid-cols-2 gap-3"><button onClick={() => setConfirmCancel(false)} className="h-11 rounded-xl border border-[#dfe5e2] text-sm font-semibold">Stay in line</button><button onClick={cancelTicket} disabled={cancelling} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-semibold text-white">{cancelling ? <Spinner /> : "Leave queue"}</button></div></div>
        </div>
      )}
    </main>
  );
}
