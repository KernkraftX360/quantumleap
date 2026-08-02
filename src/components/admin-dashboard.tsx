"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BellRing,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleEllipsis,
  Clock3,
  Download,
  Edit3,
  ExternalLink,
  Gauge,
  Layers3,
  LayoutDashboard,
  ListFilter,
  LogOut,
  MapPin,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  Trash2,
  TrendingUp,
  UserRound,
  UserPlus,
  UserX,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { EmptyState } from "@/components/empty-state";
import { Spinner } from "@/components/spinner";
import { authHeaders, getSessionToken } from "@/lib/authed-fetch";
import type { NoShowAnalytics } from "@/lib/queue";
import { signOut } from "@/lib/signout";
import { CATEGORIES, CATEGORY_COLORS, getCategory } from "@/lib/categories";
import { MALAYSIA_STATES } from "@/lib/malaysia-states";

type LocationRow = {
  id: number; name: string; slug: string; address: string; latitude: string; longitude: string;
  phone: string | null; status: string; openingTime: string; closingTime: string; accent: string; category: string; state: string | null; createdAt: Date | string;
};
type ServiceRow = {
  id: number; establishmentId: number; name: string; description: string | null; durationMinutes: number;
  capacity: number; color: string; active: boolean; createdAt: Date | string;
};
type TicketRow = {
  id: number; publicId: string; ticketNumber: string; customerName: string; phone: string | null; status: string;
  partySize: number; travelMinutes: number; distanceKm: string | null; joinedAt: Date | string; updatedAt: Date | string;
  calledAt: Date | string | null; startedAt: Date | string | null; completedAt: Date | string | null;
  requeuedAt: Date | string | null; previousNumber: string | null;
  establishmentId: number; serviceId: number; establishmentName: string; serviceName: string; durationMinutes: number;
};
type DashboardData = { locations: LocationRow[]; services: ServiceRow[]; tickets: TicketRow[]; noShowAnalytics: NoShowAnalytics };
type User = { id: number; name: string; email: string; role: string; avatarUrl: string | null };
type NavKey = "overview" | "queue" | "services" | "locations" | "customers" | "analytics" | "settings";

const navItems: { key: NavKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "queue", label: "Live queue", icon: Activity },
  { key: "services", label: "Services", icon: Layers3 },
  { key: "locations", label: "Locations", icon: MapPin },
  { key: "customers", label: "Customers", icon: Users },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
];
const activeStatuses = ["waiting", "called", "serving"];
const statusStyles: Record<string, string> = {
  waiting: "bg-amber-50 text-amber-700 ring-amber-200",
  called: "bg-violet-50 text-violet-700 ring-violet-200",
  serving: "bg-blue-50 text-blue-700 ring-blue-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
  no_show: "bg-red-50 text-red-700 ring-red-200",
  holding: "bg-amber-100 text-amber-800 ring-amber-300",
};
const colorStyles: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700",
  blue: "bg-blue-50 text-blue-700",
  violet: "bg-violet-50 text-violet-700",
  amber: "bg-amber-50 text-amber-700",
};

const NOTIF_META: Record<string, { title: (t: { ticketNumber: string; customerName: string }) => string }> = {
  waiting: { title: (t) => `${t.customerName} joined the queue` },
  called: { title: (t) => `${t.ticketNumber} called to the desk` },
  serving: { title: (t) => `${t.customerName} is being served` },
  completed: { title: (t) => `${t.customerName} completed their visit` },
  no_show: { title: (t) => `${t.customerName} was marked no-show` },
  cancelled: { title: (t) => `${t.customerName} left the queue` },
};
const NOTIF_ICON: Record<string, { Icon: typeof Bell; tone: string }> = {
  waiting: { Icon: UserPlus, tone: "bg-emerald-50 text-emerald-700" },
  called: { Icon: BellRing, tone: "bg-violet-50 text-violet-700" },
  serving: { Icon: Activity, tone: "bg-blue-50 text-blue-700" },
  completed: { Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
  no_show: { Icon: UserX, tone: "bg-rose-50 text-rose-600" },
  cancelled: { Icon: X, tone: "bg-slate-100 text-slate-600" },
  requeued: { Icon: Repeat, tone: "bg-amber-50 text-amber-700" },
};

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
function relativeTime(value: Date | string | number) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
function StatusPill({ status }: { status: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ring-1 ring-inset ${statusStyles[status] ?? statusStyles.cancelled}`}><span className="size-1.5 rounded-full bg-current" />{status.replace("_", " ")}</span>;
}

export function AdminDashboard({ initialData, user, initialToken }: { initialData: DashboardData | null; user: User | null; initialToken?: string }) {
  const router = useRouter();
  const haveInitial = !!user && !!initialData;
  const [ready, setReady] = useState(haveInitial);
  const [authedUser, setAuthedUser] = useState<User | null>(user);
  const [authedData, setAuthedData] = useState<DashboardData | null>(initialData);

  useEffect(() => {
    if (initialToken && typeof window !== "undefined") {
      (window as unknown as { __QL_SESSION__?: string }).__QL_SESSION__ = initialToken;
      try { localStorage.setItem("ql_session", initialToken); } catch { /* storage blocked */ }
    }
  }, [initialToken]);

  // No server session on this render (e.g. a cookie-less reload): re-authenticate with the
  // token the client persisted, so a signed-in user is never kicked out by a refresh.
  useEffect(() => {
    if (haveInitial) return;
    let cancelled = false;
    (async () => {
      const h = authHeaders();
      try {
        const [meRes, dataRes] = await Promise.all([
          fetch("/api/auth/me", { headers: h, cache: "no-store" }),
          fetch("/api/dashboard", { headers: h, cache: "no-store" }),
        ]);
        if (meRes.ok && dataRes.ok) {
          if (!cancelled) {
            setAuthedUser((await meRes.json()) as User);
            setAuthedData((await dataRes.json()) as DashboardData);
            setReady(true);
          }
        } else if (!cancelled) {
          router.push("/login");
        }
      } catch {
        if (!cancelled) router.push("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [haveInitial, router]);

  useEffect(() => {
    if (ready && typeof window !== "undefined" && window.location.search) window.history.replaceState(null, "", "/dashboard");
  }, [ready]);

  if (!ready || !authedUser || !authedData) return <LoadingScreen />;
  return <DashboardShell initialData={authedData} user={authedUser} initialToken={initialToken} />;
}

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f5f7f6]">
      <div className="flex flex-col items-center gap-4">
        <Brand />
        <div className="flex items-center gap-1.5">
          <span className="size-2 animate-bounce rounded-full bg-[#13795b] [animation-delay:-0.2s]" />
          <span className="size-2 animate-bounce rounded-full bg-[#13795b] [animation-delay:-0.1s]" />
          <span className="size-2 animate-bounce rounded-full bg-[#13795b]" />
        </div>
        <p className="text-xs font-medium text-[#76837e]">Loading your dashboard…</p>
      </div>
    </div>
  );
}

function DashboardShell({ initialData, user, initialToken }: { initialData: DashboardData; user: User; initialToken?: string }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [active, setActive] = useState<NavKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [lastRead, setLastRead] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try {
      const v = Number(localStorage.getItem("ql_notif_read"));
      if (Number.isFinite(v) && v > 0) return v;
    } catch {
      /* ignore */
    }
    return 0;
  });
  const notifRef = useRef<HTMLDivElement>(null);
  const notifications = useMemo(() => {
    const ev: { id: string; type: string; title: string; desc: string; time: number }[] = [];
    for (const t of data.tickets) {
      const reT = t.requeuedAt ? new Date(t.requeuedAt).getTime() : 0;
      if (reT) {
        ev.push({ id: `${t.id}-rq`, type: "requeued", title: `${t.customerName} auto-moved to ${t.ticketNumber}`, desc: `${t.previousNumber ? `was ${t.previousNumber} · ` : ""}${t.establishmentName}`, time: reT });
      }
      const recentRequeue = reT && new Date(t.joinedAt).getTime() - reT < 60_000;
      if (t.status === "waiting" && recentRequeue) continue;
      const raw =
        t.status === "completed"
          ? t.completedAt
          : t.status === "serving"
            ? t.startedAt
            : t.status === "called"
              ? t.calledAt
              : t.status === "waiting"
                ? t.joinedAt
                : t.updatedAt;
      const time = raw ? new Date(raw).getTime() : 0;
      const meta = NOTIF_META[t.status];
      if (!time || !meta) continue;
      ev.push({ id: String(t.id), type: t.status, title: meta.title(t), desc: `${t.serviceName} · ${t.establishmentName}`, time });
    }
    return ev.sort((a, b) => b.time - a.time).slice(0, 10);
  }, [data.tickets]);
  const unread = useMemo(() => notifications.filter((n) => n.time > lastRead).length, [notifications, lastRead]);
  useEffect(() => {
    if (!notifOpen) return;
    const onDown = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [notifOpen]);
  useEffect(() => {
    try {
      localStorage.setItem("ql_notif_read", String(lastRead));
    } catch {
      /* ignore */
    }
  }, [lastRead]);
  const [queueFilter, setQueueFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ id: number; msg: string; tone: "ok" | "err" } | null>(null);
  const [locationModal, setLocationModal] = useState<LocationRow | "new" | null>(null);
  const [serviceModal, setServiceModal] = useState<ServiceRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<{ kind: "location" | "service" | "ticket"; id: number; name: string } | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);

  async function refresh(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store", credentials: "include", headers: authHeaders() });
      if (response.status === 401) {
        if (!getSessionToken()) router.push("/login");
        return;
      }
      if (response.ok) setData(await response.json());
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  useEffect(() => {
    let es: EventSource | null = null;
    const connect = () => {
      const token = getSessionToken();
      es = new EventSource(token ? `/api/events?session=${encodeURIComponent(token)}` : "/api/events", { withCredentials: true });
      es.onmessage = () => refresh(true);
      es.onerror = () => {
        /* EventSource auto-reconnects; the fallback interval below covers full outages. */
      };
    };
    connect();
    const fallback = window.setInterval(() => refresh(true), 60_000);
    return () => {
      try {
        es?.close();
      } catch {
        /* ignore */
      }
      window.clearInterval(fallback);
    };
  }, []);

  function notify(message: string, tone: "ok" | "err" = "ok") {
    setToast({ id: Date.now(), msg: message, tone });
  }
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Make every admin /api call carry the stored session token as a header, so actions
  // (call / cancel / pause / walk-in / save) still authenticate in embedded contexts where
  // the httpOnly cookie can't be stored — without this they 401 and silently revert.
  useEffect(() => {
    // The server resolved the session (cookie or ?session) and handed it here as initialToken.
    // Stash it client-side so action calls can send it even when the cookie/localStorage were
    // unavailable at login (embedded contexts) — without this, Call next / Cancel 401 and revert.
    if (initialToken && typeof window !== "undefined") {
      (window as unknown as { __QL_SESSION__?: string }).__QL_SESSION__ = initialToken;
      try {
        localStorage.setItem("ql_session", initialToken);
      } catch {
        /* storage blocked */
      }
    }
    const orig = window.fetch;
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
        const token = getSessionToken();
        if (token && url.includes("/api/")) {
          const headers = new Headers(init?.headers);
          if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
          return orig.call(window, input, { ...init, headers });
        }
      } catch {
        /* fall through to original fetch */
      }
      return orig.call(window, input, init);
    };
    return () => {
      window.fetch = orig;
    };
  }, []);

  // The login redirect carries the session token in the URL; once the client has stashed it
  // (via getSessionToken) we tidy it out of the address bar so the token isn't left in the URL.
  useEffect(() => {
    if (typeof window === "undefined" || !window.location.search) return;
    const t = window.setTimeout(() => {
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch {
        /* ignore */
      }
    }, 1500);
    return () => window.clearTimeout(t);
  }, []);

  async function updateTicket(id: number, status: string) {
    const previous = data;
    setData((current) => ({ ...current, tickets: current.tickets.map((ticket) => ticket.id === id ? { ...ticket, status, updatedAt: new Date().toISOString() } : ticket) }));
    const patchInit = (): RequestInit => ({ method: "PATCH", credentials: "include", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ status }) });
    let response = await fetch(`/api/tickets/${id}`, patchInit());
    if (response.status === 401) response = await fetch(`/api/tickets/${id}`, patchInit()); // retry once if the token wasn't attached first try
    if (!response.ok) {
      setData(previous);
      notify("Update failed — your change was restored.", "err");
    } else {
      notify(
        status === "called"
          ? "Called · moved to in-service"
          : status === "serving"
            ? "Now serving"
            : status === "cancelled"
              ? "Cancelled · removed from the queue"
              : status === "completed"
                ? "Marked complete"
                : status === "renumber"
                  ? "New number assigned"
                  : "Queue updated",
      );
      void refresh(true);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const previous = data;
    if (deleting.kind === "location") setData((current) => ({ ...current, locations: current.locations.filter((item) => item.id !== deleting.id) }));
    if (deleting.kind === "service") setData((current) => ({ ...current, services: current.services.filter((item) => item.id !== deleting.id) }));
    if (deleting.kind === "ticket") setData((current) => ({ ...current, tickets: current.tickets.filter((item) => item.id !== deleting.id) }));
    const path = deleting.kind === "location" ? "locations" : deleting.kind === "service" ? "services" : "tickets";
    const response = await fetch(`/api/${path}/${deleting.id}`, { method: "DELETE", credentials: "include", headers: authHeaders() });
    if (!response.ok) {
      setData(previous);
      notify("Delete failed — the item was restored.");
    } else { notify(`${deleting.name} deleted.`); void refresh(true); }
    setDeleting(null);
  }

  async function togglePause(location: LocationRow) {
    const next = location.status === "paused" ? "open" : "paused";
    const previous = data;
    setData((current) => ({ ...current, locations: current.locations.map((item) => item.id === location.id ? { ...item, status: next } : item) }));
    const response = await fetch(`/api/locations/${location.id}`, { method: "PATCH", credentials: "include", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ status: next }) });
    if (!response.ok) { setData(previous); notify("Couldn’t update queue status."); }
    else { notify(next === "paused" ? `${location.name} queue paused — public joins blocked.` : `${location.name} queue resumed.`); void refresh(true); }
  }

  async function logout() {
    await signOut();
  }

  const activeTickets = data.tickets.filter((ticket) => activeStatuses.includes(ticket.status));
  const waitingTickets = data.tickets.filter((ticket) => ticket.status === "waiting");
  const completed = data.tickets.filter((ticket) => ticket.status === "completed");
  const averageWait = waitingTickets.length ? Math.round(waitingTickets.reduce((sum, ticket, index) => sum + ticket.durationMinutes * index / Math.max(1, data.services.find((service) => service.id === ticket.serviceId)?.capacity ?? 1), 0) / waitingTickets.length) : 0;

  const filteredTickets = useMemo(() => {
    const order: Record<string, number> = { serving: 0, called: 1, waiting: 2, holding: 3, completed: 4, cancelled: 5, no_show: 6 };
    return data.tickets
      .filter((ticket) => {
        const matchesStatus = queueFilter === "all" || (queueFilter === "active" ? activeStatuses.includes(ticket.status) : ticket.status === queueFilter);
        const query = search.toLowerCase();
        return matchesStatus && (!query || `${ticket.ticketNumber} ${ticket.customerName} ${ticket.serviceName} ${ticket.establishmentName}`.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const oa = order[a.status] ?? 9;
        const ob = order[b.status] ?? 9;
        if (oa !== ob) return oa - ob;
        // waiting / holding: FIFO (longest-waiting first = next to call); others: most recent first
        if (a.status === "waiting" || a.status === "holding") return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [data.tickets, queueFilter, search]);

  const currentLabel = navItems.find((item) => item.key === active)?.label ?? "Overview";
  const ownedName = user.role === "business" ? data.locations[0]?.name ?? null : null;

  return (
    <div className="min-h-screen bg-[#f5f7f6] text-[#1b2b25]">
      {sidebarOpen && <button aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-[#10281f]/40 backdrop-blur-sm lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-[#e6ebe8] bg-white transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[72px] items-center justify-between border-b border-[#edf0ee] px-5"><Brand /><button onClick={() => setSidebarOpen(false)} className="grid size-8 place-items-center rounded-lg bg-[#f3f5f4] lg:hidden"><X size={17} /></button></div>
        <div className="px-3 py-5">
          <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[.16em] text-[#9aa49f]">Workspace</p>
          <nav className="space-y-1">
            {navItems.slice(0, 6).map((item) => <button key={item.key} onClick={() => { setActive(item.key); setSidebarOpen(false); }} className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${active === item.key ? "bg-[#eaf5ef] text-[#12644a]" : "text-[#64726d] hover:bg-[#f4f6f5] hover:text-[#25352f]"}`}><item.icon size={17} strokeWidth={active === item.key ? 2.3 : 1.9} /><span>{item.label}</span>{item.key === "queue" && activeTickets.length > 0 && <span className="ml-auto rounded-full bg-[#13795b] px-2 py-0.5 text-[9px] font-bold text-white">{activeTickets.length}</span>}</button>)}
          </nav>
          <p className="mb-2 mt-6 px-3 text-[9px] font-bold uppercase tracking-[.16em] text-[#9aa49f]">Manage</p>
          <button onClick={() => { setActive("settings"); setSidebarOpen(false); }} className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${active === "settings" ? "bg-[#eaf5ef] text-[#12644a]" : "text-[#64726d] hover:bg-[#f4f6f5]"}`}><Settings size={17} /> Settings</button>
          <a href="/" target="_blank" rel="noreferrer" className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#64726d] transition hover:bg-[#f4f6f5] hover:text-[#25352f]"><ExternalLink size={17} /> Customer site</a>
        </div>
        <div className="mx-4 mt-auto mb-4 rounded-2xl bg-[#123e32] p-4 text-white">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#8dd8b6]"><Sparkles size={13} /> Operations tip</div>
          <p className="mt-2 text-xs leading-5 text-white/75">Calling the next guest early can reduce idle service time by 18%.</p>
        </div>
        <div className="border-t border-[#edf0ee] p-3">
          <div className="flex items-center gap-3 rounded-xl p-2"><span className="grid size-9 place-items-center rounded-xl bg-[#dfeee7] text-xs font-bold text-[#166a4f]">{initials(user.name)}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{user.name}</span><span className="block truncate text-[10px] text-[#8b9692]">{user.role === "admin" ? "Administrator" : "Business"}</span></span></div>
          <button onClick={logout} title="Sign out" className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-[#ecd9d9] bg-rose-50 py-2 text-xs font-bold text-[#b04a4a] transition hover:bg-rose-100"><LogOut size={15} /> Sign out</button>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center border-b border-[#e3e8e5] bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button onClick={() => setSidebarOpen(true)} className="mr-3 grid size-9 place-items-center rounded-xl border border-[#e1e6e3] lg:hidden"><Menu size={18} /></button>
          <div className="min-w-0"><h1 className="truncate text-base font-semibold tracking-[-.02em]">{currentLabel}</h1><p className="mt-0.5 hidden truncate text-[10px] text-[#8a9691] sm:block">{active === "overview" ? "Here’s what’s happening across your queues." : ownedName ? `Managing ${ownedName}` : `Manage ${currentLabel.toLowerCase()} across your workspace.`}</p></div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => refresh()} className="grid size-9 place-items-center rounded-xl border border-[#e1e6e3] bg-white text-[#65736e]" aria-label="Refresh"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /></button>
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen((o) => !o)} aria-label="Notifications" aria-expanded={notifOpen} className="relative grid size-9 place-items-center rounded-xl border border-[#e1e6e3] bg-white text-[#65736e] transition hover:border-[#13795b] hover:text-[#13795b]">
                <Bell size={16} />
                {unread > 0 && (
                  <>
                    <span className="absolute -right-1 -top-1 size-[18px] animate-ping rounded-full bg-rose-400/60" />
                    <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>
                  </>
                )}
              </button>
              {notifOpen && (
                <div className="animate-fade-up absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#e3e8e5] bg-white shadow-[0_20px_50px_rgba(18,35,30,.18)]">
                  <div className="flex items-center justify-between border-b border-[#edf0ee] px-4 py-3">
                    <div className="flex items-center gap-2"><Bell size={15} className="text-[#13795b]" /><span className="text-sm font-semibold">Notifications</span>{unread > 0 && <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-600">{unread} new</span>}</div>
                    <button onClick={() => setLastRead(Date.now())} disabled={unread === 0} className="text-[11px] font-semibold text-[#13795b] transition hover:text-[#0e684e] disabled:text-[#b7c0bb]">Mark all read</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center"><Bell size={20} className="text-[#b7c0bb]" /><p className="text-xs font-medium text-[#89948f]">You’re all caught up</p></div>
                    ) : (
                      notifications.map((n) => {
                        const m = NOTIF_ICON[n.type] ?? NOTIF_ICON.waiting;
                        const isUnread = n.time > lastRead;
                        return (
                          <div
                            key={n.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setLastRead(Date.now())}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setLastRead(Date.now());
                              }
                            }}
                            className={`flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition hover:bg-[#f6f8f7] ${isUnread ? "bg-[#f4faf7]" : ""}`}
                          >
                            <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${m.tone}`}><m.Icon size={15} /></span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5"><span className="truncate text-xs font-semibold text-[#263630]">{n.title}</span>{isUnread && <span className="size-1.5 shrink-0 rounded-full bg-rose-500" />}</span>
                              <span className="mt-0.5 block truncate text-[11px] text-[#89948f]">{n.desc}</span>
                              <span className="mt-1 block text-[10px] text-[#aab2ad]">{relativeTime(n.time)}</span>
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="border-t border-[#edf0ee] px-4 py-2.5 text-center text-[11px] font-medium text-[#89948f]">Live activity · updates automatically</div>
                </div>
              )}
            </div>
            <Link href="/" target="_blank" className="hidden h-9 items-center gap-2 rounded-xl border border-[#dce3df] px-3 text-xs font-semibold text-[#53625d] sm:flex">Customer view <ExternalLink size={13} /></Link>
            <button onClick={() => setWalkInOpen(true)} className="flex h-9 items-center gap-2 rounded-xl bg-[#0f684e] px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#13795b]"><UserPlus size={15} /> <span className="hidden sm:inline">Add walk-in</span></button>
            {active === "services" && <button onClick={() => setServiceModal("new")} className="flex h-9 items-center gap-2 rounded-xl bg-[#13795b] px-3.5 text-xs font-bold text-white"><Plus size={15} /> <span className="hidden sm:inline">Add service</span></button>}
            {active === "locations" && user.role === "admin" && <button onClick={() => setLocationModal("new")} className="flex h-9 items-center gap-2 rounded-xl bg-[#13795b] px-3.5 text-xs font-bold text-white"><Plus size={15} /> <span className="hidden sm:inline">Add location</span></button>}
            <button onClick={logout} title="Sign out" className="flex h-9 items-center gap-1.5 rounded-xl border border-[#ecd9d9] bg-rose-50 px-3 text-xs font-bold text-[#b04a4a] transition hover:bg-rose-100"><LogOut size={15} /><span className="hidden sm:inline">Sign out</span></button>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          {active === "overview" && <Overview data={data} activeTickets={activeTickets} waitingTickets={waitingTickets} completed={completed} averageWait={averageWait} setActive={setActive} updateTicket={updateTicket} user={user} />}
          {active === "queue" && <QueueView tickets={filteredTickets} filter={queueFilter} setFilter={setQueueFilter} search={search} setSearch={setSearch} updateTicket={updateTicket} onAddWalkIn={() => setWalkInOpen(true)} onDelete={(ticket) => setDeleting({ kind: "ticket", id: ticket.id, name: ticket.ticketNumber })} />}
          {active === "services" && <ServicesView services={data.services} locations={data.locations} tickets={data.tickets} onAdd={() => setServiceModal("new")} onEdit={setServiceModal} onDelete={(service) => setDeleting({ kind: "service", id: service.id, name: service.name })} updateService={(service) => setData((current) => ({ ...current, services: current.services.map((item) => item.id === service.id ? service : item) }))} notify={notify} />}
          {active === "locations" && <LocationsView locations={data.locations} services={data.services} tickets={data.tickets} onAdd={() => setLocationModal("new")} onEdit={setLocationModal} onTogglePause={togglePause} canCreate={user.role === "admin"} canDelete={user.role === "admin"} onDelete={(location) => setDeleting({ kind: "location", id: location.id, name: location.name })} />}
          {active === "customers" && <CustomersView tickets={data.tickets} />}
          {active === "analytics" && <AnalyticsView data={data} />}
          {active === "settings" && <SettingsView user={user} notify={notify} />}
        </main>
      </div>

      {locationModal && <LocationModal value={locationModal} onClose={() => setLocationModal(null)} onSaved={async () => { setLocationModal(null); await refresh(true); notify(locationModal === "new" ? "Location created." : "Location updated."); }} />}
      {serviceModal && <ServiceModal value={serviceModal} locations={data.locations} onClose={() => setServiceModal(null)} onSaved={async () => { setServiceModal(null); await refresh(true); notify(serviceModal === "new" ? "Service created." : "Service updated."); }} />}
      {walkInOpen && <WalkInModal locations={data.locations} services={data.services} onClose={() => setWalkInOpen(false)} onSaved={async () => { setWalkInOpen(false); await refresh(true); notify("Walk-in added to the queue."); }} />}
      {deleting && <DeleteModal item={deleting} onClose={() => setDeleting(null)} onDelete={confirmDelete} />}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center px-4">
          <div className={`pointer-events-auto flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-[0_18px_45px_rgba(18,35,30,.22)] animate-fade-up ${toast.tone === "err" ? "bg-red-600 text-white" : "bg-[#153c32] text-white"}`}>
            {toast.tone === "err" ? <X size={17} className="text-red-200" /> : <CheckCircle2 size={17} className="text-[#7ed7ad]" />}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

function Overview({ data, activeTickets, waitingTickets, completed, averageWait, setActive, updateTicket, user }: { data: DashboardData; activeTickets: TicketRow[]; waitingTickets: TicketRow[]; completed: TicketRow[]; averageWait: number; setActive: (tab: NavKey) => void; updateTicket: (id: number, status: string) => void; user: User; }) {
  const peak = Math.max(1, ...data.locations.map((location) => activeTickets.filter((ticket) => ticket.establishmentId === location.id).length));
  const hourly = [4, 7, 5, 11, 15, 12, 18, 14, 9, 6, 3, 2];
  const maxHourly = Math.max(...hourly);
  const stats = [
    { label: "People in queue", value: activeTickets.length, detail: `${waitingTickets.length} waiting now`, icon: Users, tone: "bg-[#e8f5ef] text-[#13795b]", trend: "+8.2%", up: true },
    { label: "Average wait", value: `${averageWait || 8} min`, detail: "Across active services", icon: Clock3, tone: "bg-amber-50 text-amber-700", trend: "-2.4%", up: false },
    { label: "Served today", value: data.noShowAnalytics.completedToday, detail: `${data.noShowAnalytics.totalCompleted} served this week`, icon: CheckCircle2, tone: "bg-blue-50 text-blue-700", trend: "+12.5%", up: true },
    { label: "Active locations", value: data.locations.filter((item) => item.status !== "closed").length, detail: `${data.services.filter((item) => item.active).length} services online`, icon: Building2, tone: "bg-violet-50 text-violet-700", trend: "Stable", up: true },
  ];
  return <div className="animate-fade-up space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-semibold tracking-[-.04em]">Good morning, {user.name.split(" ")[0]}</h2><p className="mt-1 text-sm text-[#76837e]">Queues are moving smoothly. Here’s your live operational snapshot.</p></div><div className="flex items-center gap-2 text-[11px] text-[#6f7d77]"><span className="relative size-2 rounded-full bg-green-500 live-dot" /> Live · updates every 10 seconds</div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => <div key={stat.label} className="rounded-2xl border border-[#e1e7e4] bg-white p-5 card-shadow"><div className="flex items-start justify-between"><span className={`grid size-10 place-items-center rounded-xl ${stat.tone}`}><stat.icon size={18} /></span><span className={`flex items-center gap-1 text-[10px] font-bold ${stat.up ? "text-emerald-600" : "text-blue-600"}`}>{stat.trend}{stat.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}</span></div><p className="mt-5 text-[28px] font-semibold leading-none tracking-[-.04em]">{stat.value}</p><p className="mt-2 text-xs font-medium text-[#64726d]">{stat.label}</p><p className="mt-1 text-[10px] text-[#98a19d]">{stat.detail}</p></div>)}</div>
    <NoShowPanel analytics={data.noShowAnalytics} />
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <div className="rounded-2xl border border-[#e1e7e4] bg-white card-shadow">
        <div className="flex items-center justify-between border-b border-[#edf0ee] px-5 py-4"><div><h3 className="text-sm font-semibold">Queue activity</h3><p className="mt-1 text-[10px] text-[#8c9792]">Arrivals by hour · today</p></div><button className="flex items-center gap-2 rounded-lg border border-[#e3e8e5] px-2.5 py-2 text-[10px] font-semibold">Today <ChevronDown size={12} /></button></div>
        <div className="px-5 pb-4 pt-7"><div className="flex h-44 items-end gap-2">{hourly.map((value, index) => <div key={index} className="group flex h-full flex-1 flex-col justify-end"><div className="relative rounded-t-md bg-[#dcece5] transition hover:bg-[#17815f]" style={{ height: `${Math.max(8, (value / maxHourly) * 100)}%` }}><span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 text-[9px] font-bold group-hover:block">{value}</span></div></div>)}</div><div className="mt-3 flex justify-between text-[9px] text-[#9aa49f]"><span>8am</span><span>10am</span><span>12pm</span><span>2pm</span><span>4pm</span><span>6pm</span></div></div>
      </div>
      <div className="rounded-2xl border border-[#e1e7e4] bg-white p-5 card-shadow"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Queue load</h3><p className="mt-1 text-[10px] text-[#8c9792]">By location right now</p></div><Gauge size={18} className="text-[#17815f]" /></div><div className="mt-6 space-y-5">{data.locations.map((location) => { const count = activeTickets.filter((ticket) => ticket.establishmentId === location.id).length; return <div key={location.id}><div className="mb-2 flex items-center justify-between"><span className="truncate pr-3 text-xs font-medium">{location.name}</span><span className="text-xs font-bold">{count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#edf1ef]"><div className={`h-full rounded-full ${count / peak > .75 ? "bg-amber-500" : "bg-[#17815f]"}`} style={{ width: `${Math.max(5, count / peak * 100)}%` }} /></div></div>; })}</div></div>
    </div>
    <div className="rounded-2xl border border-[#e1e7e4] bg-white card-shadow"><div className="flex items-center justify-between border-b border-[#edf0ee] px-5 py-4"><div><h3 className="text-sm font-semibold">Live queue</h3><p className="mt-1 text-[10px] text-[#8c9792]">Most recent customer arrivals</p></div><button onClick={() => setActive("queue")} className="flex items-center gap-1 text-xs font-semibold text-[#13795b]">View all <ArrowRight size={13} /></button></div><div className="overflow-x-auto"><QueueTable tickets={activeTickets.slice(0, 6)} updateTicket={updateTicket} /></div></div>
  </div>;
}

function NoShowPanel({ analytics }: { analytics: NoShowAnalytics }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);
  const days = analytics.days;
  const maxBar = Math.max(1, ...days.map((d) => Math.max(d.noShow, d.completed)));
  const maxHot = Math.max(1, ...analytics.hotspots.map((h) => h.count));
  const R = 42;
  const C = 2 * Math.PI * R;
  const rate = analytics.noShowRate;
  const dash = mounted ? C * (1 - Math.min(100, rate) / 100) : C;
  return (
    <div className="rounded-2xl border border-[#e1e7e4] bg-white p-5 card-shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">No-show insights</h3>
          <p className="mt-1 text-[10px] text-[#8c9792]">Rolling 7 days · completed vs no-show</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-600"><span className="size-1.5 rounded-full bg-rose-500" />{rate}% no-show rate</span>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="flex h-40 items-end gap-2 sm:gap-3">
            {days.map((d, i) => (
              <div key={d.label} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div className="flex h-full w-full items-end justify-center gap-[3px]">
                  <div className="relative w-1/2 rounded-t-md bg-emerald-300 transition-all duration-700 ease-out group-hover:bg-emerald-500" style={{ height: mounted ? `${Math.max(4, (d.completed / maxBar) * 100)}%` : "0%", transitionDelay: `${i * 55}ms` }}>
                    <span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[9px] font-bold text-emerald-700 group-hover:block">{d.completed}</span>
                  </div>
                  <div className="relative w-1/2 rounded-t-md bg-rose-400 transition-all duration-700 ease-out group-hover:bg-rose-600" style={{ height: mounted ? `${Math.max(4, (d.noShow / maxBar) * 100)}%` : "0%", transitionDelay: `${i * 55 + 30}ms` }}>
                    <span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[9px] font-bold text-rose-600 group-hover:block">{d.noShow}</span>
                  </div>
                </div>
                <span className="text-[9px] font-medium text-[#9aa49f]">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-[10px] text-[#76837e]">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-emerald-300" /> Completed</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-rose-400" /> No-show</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-[#f7f9f8] p-4">
          <div className="relative grid place-items-center">
            <svg width="124" height="124" viewBox="0 0 100 100" className="-rotate-90">
              <circle cx="50" cy="50" r={R} fill="none" stroke="#e7ece9" strokeWidth="10" />
              <circle cx="50" cy="50" r={R} fill="none" stroke="#f43f5e" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={dash} style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.7,.2,1)" }} />
            </svg>
            <div className="absolute text-center">
              <p className="text-2xl font-bold tracking-[-0.03em] text-[#1b2b25]">{rate}%</p>
              <p className="text-[9px] uppercase tracking-wide text-[#9aa49f]">no-show</p>
            </div>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white p-2"><p className="text-base font-bold text-rose-600">{analytics.totalNoShow}</p><p className="text-[9px] uppercase tracking-wide text-[#9aa49f]">no-shows</p></div>
            <div className="rounded-xl bg-white p-2"><p className="text-base font-bold text-emerald-600">{analytics.completedToday}</p><p className="text-[9px] uppercase tracking-wide text-[#9aa49f]">today</p></div>
            <div className="rounded-xl bg-white p-2"><p className="text-base font-bold text-[#1b2b25]">{analytics.totalCancelled}</p><p className="text-[9px] uppercase tracking-wide text-[#9aa49f]">cancelled</p></div>
          </div>
        </div>
      </div>
      {analytics.hotspots.length > 0 && (
        <div className="mt-5 border-t border-[#edf0ee] pt-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#9aa49f]">No-show hotspots</p>
          <div className="space-y-2.5">
            {analytics.hotspots.map((h) => (
              <div key={h.name} className="flex items-center gap-3">
                <span className="w-40 truncate text-xs font-medium text-[#465650]">{h.name}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#edf1ef]"><div className="h-full rounded-full bg-rose-400 transition-all duration-700 ease-out" style={{ width: mounted ? `${Math.max(6, (h.count / maxHot) * 100)}%` : "0%" }} /></div>
                <span className="w-6 text-right text-xs font-bold text-rose-600">{h.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QueueTable({ tickets, updateTicket, onDelete }: { tickets: TicketRow[]; updateTicket: (id: number, status: string) => void; onDelete?: (ticket: TicketRow) => void }) {
  if (!tickets.length) return <div className="p-5"><EmptyState icon={Ticket} title="The queue is clear" description="New arrivals will appear here in real time." /></div>;
  return <table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="border-b border-[#edf0ee] text-[9px] font-bold uppercase tracking-[.1em] text-[#929d98]"><th className="px-5 py-3">Number</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Service</th><th className="px-3 py-3">Joined</th><th className="px-3 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id} className="border-b border-[#f0f2f1] last:border-0 hover:bg-[#fafbfa]"><td className="px-5 py-3.5"><Link href={`/ticket/${ticket.publicId}`} target="_blank" className="font-mono text-xs font-bold text-[#176a50] hover:underline">{ticket.ticketNumber}</Link></td><td className="px-3 py-3.5"><div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-full bg-[#edf3f0] text-[9px] font-bold text-[#52655d]">{initials(ticket.customerName)}</span><div><p className="text-xs font-semibold">{ticket.customerName}</p><p className="mt-0.5 text-[9px] text-[#97a09c]">Party of {ticket.partySize}</p></div></div></td><td className="px-3 py-3.5"><p className="max-w-40 truncate text-xs font-medium">{ticket.serviceName}</p><p className="mt-0.5 max-w-40 truncate text-[9px] text-[#939d99]">{ticket.establishmentName}</p></td><td className="px-3 py-3.5"><p className="text-xs">{relativeTime(ticket.joinedAt)}</p><p className="mt-0.5 text-[9px] text-[#939d99]">{ticket.travelMinutes}m travel</p></td><td className="px-3 py-3.5"><StatusPill status={ticket.status} /></td><td className="px-5 py-3.5"><div className="flex justify-end gap-1.5">{ticket.status === "waiting" && <button onClick={() => updateTicket(ticket.id, "called")} className="h-9 rounded-xl px-3 text-xs font-semibold bg-[#13795b] text-white shadow-sm transition hover:bg-[#0f684e] active:scale-[0.97]">Call next</button>}{ticket.status === "called" && <button onClick={() => updateTicket(ticket.id, "serving")} className="h-9 rounded-xl px-3 text-xs font-semibold bg-[#13795b] text-white shadow-sm transition hover:bg-[#0f684e] active:scale-[0.97]">Start</button>}{ticket.status === "serving" && <button onClick={() => updateTicket(ticket.id, "completed")} className="h-9 rounded-xl px-3 text-xs font-semibold bg-[#13795b] text-white shadow-sm transition hover:bg-[#0f684e] active:scale-[0.97]">Complete</button>}{ticket.status === "holding" && <><button onClick={() => updateTicket(ticket.id, "renumber")} className="h-9 rounded-xl bg-[#13795b] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0f684e] active:scale-[0.97]"><span className="inline-flex items-center gap-1.5"><RefreshCw size={13} /> New no.</span></button><button onClick={() => updateTicket(ticket.id, "cancelled")} className="h-9 rounded-xl bg-red-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.97]"><span className="inline-flex items-center gap-1.5"><XCircle size={13} /> Cancel</span></button></>}{!activeStatuses.includes(ticket.status) && ticket.status !== "holding" && <span className="inline-flex h-9 items-center px-3 text-[10px] text-[#9aa49f]">Finished</span>}{activeStatuses.includes(ticket.status) && <button onClick={() => updateTicket(ticket.id, "cancelled")} title="Cancel this ticket" className="h-9 rounded-xl bg-red-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.97]"><span className="inline-flex items-center gap-1.5"><XCircle size={13} /> Cancel</span></button>}{onDelete && <button onClick={() => onDelete(ticket)} className="grid size-9 place-items-center rounded-xl border border-[#e3e8e5] text-[#8a9691] hover:text-red-600"><Trash2 size={13} /></button>}</div></td></tr>)}</tbody></table>;
}

function QueueView({ tickets, filter, setFilter, search, setSearch, updateTicket, onDelete, onAddWalkIn }: { tickets: TicketRow[]; filter: string; setFilter: (value: string) => void; search: string; setSearch: (value: string) => void; updateTicket: (id: number, status: string) => void; onDelete: (ticket: TicketRow) => void; onAddWalkIn: () => void; }) {
  return <div className="animate-fade-up"><div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-semibold tracking-[-.04em]">Live queue control</h2><p className="mt-1 text-sm text-[#77847f]">Call, serve, complete, or remove customer tickets.</p></div><button onClick={onAddWalkIn} className="flex h-10 w-fit items-center gap-2 rounded-xl bg-[#0f684e] px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#13795b]"><UserPlus size={14} /> Add walk-in</button><button className="flex h-10 w-fit items-center gap-2 rounded-xl border border-[#dfe5e2] bg-white px-3 text-xs font-semibold"><Download size={14} /> Export</button></div><div className="overflow-hidden rounded-2xl border border-[#e1e7e4] bg-white card-shadow"><div className="flex flex-col gap-3 border-b border-[#e9edeb] p-4 sm:flex-row sm:items-center"><div className="relative max-w-sm flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8c9792]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search number, customer, service…" className="h-10 w-full rounded-xl border border-[#dfe5e2] pl-9 pr-3 text-xs outline-none focus:border-[#5b9f87]" /></div><div className="flex gap-1 overflow-x-auto">{["active", "waiting", "called", "serving", "completed", "all"].map((item) => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap h-9 rounded-xl px-3 text-xs font-semibold capitalize ${filter === item ? "bg-[#163f34] text-white" : "bg-[#f4f6f5] text-[#64726d]"}`}>{item}</button>)}</div></div><div className="overflow-x-auto"><QueueTable tickets={tickets} updateTicket={updateTicket} onDelete={onDelete} /></div></div></div>;
}

function ServicesView({ services, locations, tickets, onAdd, onEdit, onDelete, updateService, notify }: { services: ServiceRow[]; locations: LocationRow[]; tickets: TicketRow[]; onAdd: () => void; onEdit: (service: ServiceRow) => void; onDelete: (service: ServiceRow) => void; updateService: (service: ServiceRow) => void; notify: (message: string) => void }) {
  async function toggle(service: ServiceRow) { const next = { ...service, active: !service.active }; updateService(next); const response = await fetch(`/api/services/${service.id}`, { method: "PATCH", credentials: "include", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ active: next.active }) }); if (!response.ok) updateService(service); else notify(`${service.name} is now ${next.active ? "active" : "paused"}.`); }
  return <div className="animate-fade-up"><div className="mb-5"><h2 className="text-2xl font-semibold tracking-[-.04em]">Services</h2><p className="mt-1 text-sm text-[#77847f]">Configure duration, capacity, and availability for each queue.</p></div>{services.length === 0 ? <EmptyState icon={Layers3} title="No services yet" description="Create your first service to start accepting queue joins." action={<button onClick={onAdd} className="rounded-xl bg-[#13795b] px-4 py-2.5 text-xs font-bold text-white">Add service</button>} /> : <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{services.map((service) => { const location = locations.find((item) => item.id === service.establishmentId); const activeCount = tickets.filter((item) => item.serviceId === service.id && activeStatuses.includes(item.status)).length; return <article key={service.id} className="rounded-2xl border border-[#e1e7e4] bg-white p-5 card-shadow"><div className="flex items-start justify-between"><span className={`grid size-10 place-items-center rounded-xl ${colorStyles[service.color] ?? colorStyles.emerald}`}><Layers3 size={18} /></span><button className={`relative h-5 w-9 rounded-full transition ${service.active ? "bg-[#13795b]" : "bg-[#cfd7d3]"}`} onClick={() => toggle(service)} aria-label="Toggle service"><span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition ${service.active ? "left-[18px]" : "left-0.5"}`} /></button></div><h3 className="mt-4 text-sm font-semibold">{service.name}</h3><p className="mt-1 min-h-9 text-xs leading-5 text-[#7b8782]">{service.description || "No description provided."}</p><p className="mt-3 flex items-center gap-1.5 text-[10px] text-[#8b9691]"><MapPin size={12} /> {location?.name ?? "Unknown location"}</p><div className="mt-4 grid grid-cols-3 divide-x divide-[#e7ece9] rounded-xl bg-[#f6f8f7] py-3 text-center"><div><p className="text-sm font-bold">{service.durationMinutes}m</p><p className="text-[9px] text-[#929d98]">DURATION</p></div><div><p className="text-sm font-bold">{service.capacity}</p><p className="text-[9px] text-[#929d98]">CAPACITY</p></div><div><p className="text-sm font-bold">{activeCount}</p><p className="text-[9px] text-[#929d98]">IN LINE</p></div></div><div className="mt-4 flex gap-2"><button onClick={() => onEdit(service)} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-[#dfe5e2] text-[10px] font-bold"><Edit3 size={13} /> Edit</button><button onClick={() => onDelete(service)} className="grid size-9 place-items-center rounded-xl border border-[#dfe5e2] text-[#89948f] hover:text-red-600"><Trash2 size={13} /></button></div></article>; })}</div>}</div>;
}

function LocationsView({ locations, services, tickets, onAdd, onEdit, onDelete, onTogglePause, canCreate = true, canDelete = true }: { locations: LocationRow[]; services: ServiceRow[]; tickets: TicketRow[]; onAdd: () => void; onEdit: (location: LocationRow) => void; onDelete: (location: LocationRow) => void; onTogglePause: (location: LocationRow) => void; canCreate?: boolean; canDelete?: boolean; }) {
  return <div className="animate-fade-up"><div className="mb-5"><h2 className="text-2xl font-semibold tracking-[-.04em]">Locations</h2><p className="mt-1 text-sm text-[#77847f]">Manage queue destinations and their geolocation coordinates.</p></div>{locations.length === 0 ? <EmptyState icon={Building2} title="No locations yet" description="Add a physical location so customers can find and route to you." action={canCreate ? <button onClick={onAdd} className="rounded-xl bg-[#13795b] px-4 py-2.5 text-xs font-bold text-white">Add location</button> : undefined} /> : <div className="grid gap-4 xl:grid-cols-2">{locations.map((location) => { const lineCount = tickets.filter((ticket) => ticket.establishmentId === location.id && activeStatuses.includes(ticket.status)).length; const serviceCount = services.filter((service) => service.establishmentId === location.id).length; const cat = getCategory(location.category); return <article key={location.id} className={`overflow-hidden rounded-2xl border bg-white card-shadow transition ${location.status === "paused" ? "border-amber-300 ring-1 ring-amber-200" : location.status === "closed" ? "border-red-200" : "border-[#e1e7e4]"}`}><div className="relative h-28 overflow-hidden bg-[#e9f1ed]"><div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(#c6d6ce 1px, transparent 1px), linear-gradient(90deg, #c6d6ce 1px, transparent 1px)", backgroundSize: "24px 24px", transform: "rotate(6deg) scale(1.2)" }} /><span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-[#13795b] text-white shadow"><MapPin size={16} /></span><span className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold capitalize ${location.status === "paused" ? "bg-amber-100 text-amber-800" : location.status === "closed" ? "bg-red-50 text-red-700" : location.status === "busy" ? "bg-amber-50 text-amber-700" : "bg-white text-emerald-700"}`}>{location.status === "paused" && <Pause size={9} />}{location.status}</span></div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{location.name}</h3><div className="mt-1.5"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${CATEGORY_COLORS[cat.accent]?.soft ?? "bg-emerald-50"} ${CATEGORY_COLORS[cat.accent]?.text ?? "text-emerald-700"}`}>{cat.label}</span></div><p className="mt-1 text-xs leading-5 text-[#7c8883]">{location.address}</p></div><button className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f4f6f5]"><MoreHorizontal size={15} /></button></div><div className="mt-4 flex flex-wrap gap-4 text-[10px] text-[#718079]"><span className="flex items-center gap-1.5"><Users size={13} className="text-[#16805e]" /> {lineCount} in queue</span><span className="flex items-center gap-1.5"><Layers3 size={13} className="text-[#16805e]" /> {serviceCount} services</span><span className="flex items-center gap-1.5"><Clock3 size={13} className="text-[#16805e]" /> {location.openingTime}–{location.closingTime}</span></div><div className="mt-4 flex gap-2"><button onClick={() => onEdit(location)} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-[#dfe5e2] text-[10px] font-bold"><Edit3 size={13} /> Edit location</button><button onClick={() => onTogglePause(location)} title={location.status === "paused" ? "Resume queue" : "Pause queue"} className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-[10px] font-bold transition ${location.status === "paused" ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"}`}>{location.status === "paused" ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}</button><a href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`} target="_blank" rel="noreferrer" className="grid size-9 place-items-center rounded-xl border border-[#dfe5e2] text-[#65736e]"><ExternalLink size={13} /></a>{canDelete && <button onClick={() => onDelete(location)} className="grid size-9 place-items-center rounded-xl border border-[#dfe5e2] text-[#89948f] hover:text-red-600"><Trash2 size={13} /></button>}</div></div></article>; })}</div>}</div>;
}

function CustomersView({ tickets }: { tickets: TicketRow[] }) {
  const [query, setQuery] = useState("");
  const customers = useMemo(() => { const map = new Map<string, { name: string; phone: string | null; visits: number; lastVisit: Date | string; services: Set<string>; status: string }>(); tickets.forEach((ticket) => { const key = ticket.phone || ticket.customerName; const existing = map.get(key); if (existing) { existing.visits += 1; existing.services.add(ticket.serviceName); } else map.set(key, { name: ticket.customerName, phone: ticket.phone, visits: 1, lastVisit: ticket.joinedAt, services: new Set([ticket.serviceName]), status: ticket.status }); }); return [...map.values()].filter((item) => `${item.name} ${item.phone}`.toLowerCase().includes(query.toLowerCase())); }, [tickets, query]);
  return <div className="animate-fade-up"><div className="mb-5"><h2 className="text-2xl font-semibold tracking-[-.04em]">Customers</h2><p className="mt-1 text-sm text-[#77847f]">A privacy-conscious history of customer visits.</p></div><div className="overflow-hidden rounded-2xl border border-[#e1e7e4] bg-white card-shadow"><div className="flex items-center justify-between border-b border-[#e9edeb] p-4"><div className="relative w-full max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8c9792]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers…" className="h-10 w-full rounded-xl border border-[#dfe5e2] pl-9 pr-3 text-xs outline-none" /></div><span className="hidden text-[10px] text-[#8c9792] sm:block">{customers.length} customers</span></div>{customers.length === 0 ? <div className="p-5"><EmptyState icon={UserRound} title="No customers found" description="Try another name or phone number." /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="border-b border-[#edf0ee] text-[9px] font-bold uppercase tracking-wider text-[#929d98]"><th className="px-5 py-3">Customer</th><th className="px-3 py-3">Last service</th><th className="px-3 py-3">Visits</th><th className="px-3 py-3">Last seen</th><th className="px-5 py-3 text-right">Contact</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.phone || customer.name} className="border-b border-[#f0f2f1] last:border-0"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#eaf4ef] text-[10px] font-bold text-[#176a50]">{initials(customer.name)}</span><div><p className="text-xs font-semibold">{customer.name}</p><p className="mt-0.5 text-[9px] text-[#939d99]">{customer.phone || "No phone provided"}</p></div></div></td><td className="px-3 py-4 text-xs">{[...customer.services][0]}</td><td className="px-3 py-4 text-xs font-bold">{customer.visits}</td><td className="px-3 py-4 text-xs text-[#708079]">{relativeTime(customer.lastVisit)}</td><td className="px-5 py-4 text-right"><button className="grid size-8 place-items-center rounded-lg border border-[#e1e6e3] text-[#6e7c76] ml-auto"><MessageSquareText size={14} /></button></td></tr>)}</tbody></table></div>}</div></div>;
}

function AnalyticsView({ data }: { data: DashboardData }) {
  const days = [42, 57, 48, 71, 64, 86, 74];
  const max = Math.max(...days);
  const popular = data.services.map((service) => ({ ...service, count: data.tickets.filter((ticket) => ticket.serviceId === service.id).length })).sort((a, b) => b.count - a.count).slice(0, 5);
  return <div className="animate-fade-up space-y-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-semibold tracking-[-.04em]">Analytics</h2><p className="mt-1 text-sm text-[#77847f]">Understand volume, performance, and customer flow.</p></div><button className="flex h-10 w-fit items-center gap-2 rounded-xl border border-[#dfe5e2] bg-white px-3 text-xs font-semibold"><Download size={14} /> Export report</button></div><div className="grid gap-4 md:grid-cols-3">{[[TrendingUp, "Weekly arrivals", "442", "+14.2%"], [Zap, "Service rate", "91%", "+3.1%"], [Clock3, "Time saved", "38h", "+8.7%"]].map(([Icon, label, value, trend]) => { const StatIcon = Icon as typeof TrendingUp; return <div key={String(label)} className="rounded-2xl border border-[#e1e7e4] bg-white p-5 card-shadow"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-[#e9f5ef] text-[#13795b]"><StatIcon size={17} /></span><span className="text-[10px] font-bold text-emerald-600">{String(trend)}</span></div><p className="mt-5 text-3xl font-semibold tracking-[-.04em]">{String(value)}</p><p className="mt-1 text-xs text-[#74817c]">{String(label)}</p></div>; })}</div><div className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]"><div className="rounded-2xl border border-[#e1e7e4] bg-white p-5 card-shadow"><div className="flex justify-between"><div><h3 className="text-sm font-semibold">Customer volume</h3><p className="mt-1 text-[10px] text-[#8c9792]">Last 7 days</p></div><span className="text-[10px] text-[#16805e]">+14.2% vs prior week</span></div><div className="mt-8 flex h-52 items-end gap-4 sm:gap-7">{days.map((value, index) => <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[9px] font-bold">{value}</span><div className="w-full max-w-10 rounded-t-lg bg-[#bcdccc] transition hover:bg-[#16805e]" style={{ height: `${value / max * 85}%` }} /><span className="text-[9px] text-[#939d99]">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</span></div>)}</div></div><div className="rounded-2xl border border-[#e1e7e4] bg-white p-5 card-shadow"><h3 className="text-sm font-semibold">Popular services</h3><p className="mt-1 text-[10px] text-[#8c9792]">By visit share</p><div className="mt-6 space-y-5">{popular.map((service, index) => <div key={service.id}><div className="mb-2 flex justify-between gap-3"><span className="truncate text-xs font-medium">{index + 1}. {service.name}</span><span className="text-[10px] font-bold">{service.count}</span></div><div className="h-1.5 rounded-full bg-[#edf1ef]"><div className="h-full rounded-full bg-[#17815f]" style={{ width: `${Math.max(12, service.count / Math.max(1, popular[0]?.count) * 100)}%` }} /></div></div>)}</div></div></div></div>;
}

function SettingsView({ user, notify }: { user: User; notify: (message: string) => void }) {
  const [alerts, setAlerts] = useState(true); const [autoCall, setAutoCall] = useState(false); const [locationSharing, setLocationSharing] = useState(true);
  return <div className="animate-fade-up max-w-4xl"><div className="mb-5"><h2 className="text-2xl font-semibold tracking-[-.04em]">Settings</h2><p className="mt-1 text-sm text-[#77847f]">Workspace preferences and queue behavior.</p></div><div className="space-y-4"><section className="rounded-2xl border border-[#e1e7e4] bg-white p-5 card-shadow"><h3 className="text-sm font-semibold">Profile</h3><div className="mt-5 flex items-center gap-4"><span className="grid size-14 place-items-center rounded-2xl bg-[#dfeee7] text-sm font-bold text-[#166a4f]">{initials(user.name)}</span><div><p className="text-sm font-semibold">{user.name}</p><p className="mt-1 text-xs text-[#7d8984]">{user.email}</p><span className="mt-2 inline-block rounded-md bg-[#edf6f2] px-2 py-1 text-[9px] font-bold uppercase text-[#13795b]">Workspace admin</span></div></div></section><section className="rounded-2xl border border-[#e1e7e4] bg-white p-5 card-shadow"><h3 className="text-sm font-semibold">Queue preferences</h3><p className="mt-1 text-xs text-[#87928e]">Control how your workspace handles customers.</p><div className="mt-4 divide-y divide-[#edf0ee]">{[["Customer alerts", "Notify staff when a new guest joins", alerts, setAlerts], ["Automatic calling", "Call the next guest when a service completes", autoCall, setAutoCall], ["Travel-aware queues", "Use customer GPS travel time in arrival guidance", locationSharing, setLocationSharing]].map(([title, copy, enabled, setter]) => <div key={String(title)} className="flex items-center justify-between gap-5 py-4"><div><p className="text-xs font-semibold">{String(title)}</p><p className="mt-1 text-[10px] text-[#8a9691]">{String(copy)}</p></div><button onClick={() => (setter as (value: boolean) => void)(!enabled)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-[#13795b]" : "bg-[#d2d9d5]"}`}><span className={`absolute top-1 size-4 rounded-full bg-white shadow transition ${enabled ? "left-6" : "left-1"}`} /></button></div>)}</div></section><section className="rounded-2xl border border-[#e1e7e4] bg-white p-5 card-shadow"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">Routing provider</h3><p className="mt-1 text-xs leading-5 text-[#87928e]">Keyless OSRM routing is active. Add TOMTOM_API_KEY server-side to enable free-tier live traffic.</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700">OSRM ACTIVE</span></div></section><button onClick={() => notify("Workspace settings saved.")} className="h-11 rounded-xl bg-[#13795b] px-5 text-xs font-bold text-white">Save changes</button></div></div>;
}

function ModalShell({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#10281f]/50 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="animate-fade-up max-h-[95vh] w-full overflow-y-auto rounded-t-[24px] bg-white sm:max-w-xl sm:rounded-[22px]"><div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#e8ecea] bg-white px-5 py-4"><div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-[10px] text-[#87928e]">{subtitle}</p></div><button onClick={onClose} className="grid size-8 place-items-center rounded-lg bg-[#f3f5f4]"><X size={16} /></button></div>{children}</div></div>;
}
function fieldClass() { return "mt-1.5 h-11 w-full rounded-xl border border-[#dce3df] px-3.5 text-xs outline-none focus:border-[#4b947b]"; }

function LocationModal({ value, onClose, onSaved }: { value: LocationRow | "new"; onClose: () => void; onSaved: () => void }) {
  const editing = value !== "new"; const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); const form = Object.fromEntries(new FormData(event.currentTarget)); const response = await fetch(editing ? `/api/locations/${value.id}` : "/api/locations", { method: editing ? "PATCH" : "POST", credentials: "include", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(form) }); if (!response.ok) { const body = await response.json(); setError(body.error || "Could not save location."); setSaving(false); } else onSaved(); }
  return <ModalShell title={editing ? "Edit location" : "Add a location"} subtitle="Address and coordinates power nearby search and travel estimates." onClose={onClose}><form onSubmit={submit} className="p-5"><label className="text-[10px] font-bold text-[#56655f]">LOCATION NAME<input name="name" required defaultValue={editing ? value.name : ""} placeholder="e.g. Downtown Service Center" className={fieldClass()} /></label><label className="mt-4 block text-[10px] font-bold text-[#56655f]">STREET ADDRESS<input name="address" required defaultValue={editing ? value.address : ""} placeholder="Street, district, postcode" className={fieldClass()} /></label><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-[10px] font-bold text-[#56655f]">LATITUDE<input name="latitude" required type="number" step="any" defaultValue={editing ? value.latitude : "3.1390"} className={fieldClass()} /></label><label className="text-[10px] font-bold text-[#56655f]">LONGITUDE<input name="longitude" required type="number" step="any" defaultValue={editing ? value.longitude : "101.6869"} className={fieldClass()} /></label></div><label className="mt-4 block text-[10px] font-bold text-[#56655f]">PHONE<input name="phone" defaultValue={editing ? value.phone ?? "" : ""} placeholder="+60 3-2700 1100" className={fieldClass()} /></label><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-[10px] font-bold text-[#56655f]">CATEGORY<select name="category" defaultValue={editing ? value.category : "medical"} className={fieldClass()}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label className="text-[10px] font-bold text-[#56655f]">STATE<select name="state" defaultValue={editing ? value.state ?? "" : ""} className={fieldClass()}><option value="">Select…</option>{MALAYSIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label></div><div className="mt-4 grid grid-cols-3 gap-3"><label className="text-[10px] font-bold text-[#56655f]">OPENS<input name="openingTime" type="time" defaultValue={editing ? value.openingTime : "08:00"} className={fieldClass()} /></label><label className="text-[10px] font-bold text-[#56655f]">CLOSES<input name="closingTime" type="time" defaultValue={editing ? value.closingTime : "18:00"} className={fieldClass()} /></label><label className="text-[10px] font-bold text-[#56655f]">STATUS<select name="status" defaultValue={editing ? value.status : "open"} className={fieldClass()}><option value="open">Open</option><option value="busy">Busy</option><option value="closed">Closed</option><option value="paused">Paused</option></select></label></div>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="h-10 rounded-xl border border-[#dce3df] px-4 text-xs font-semibold">Cancel</button><button disabled={saving} className="flex h-10 items-center gap-2 rounded-xl bg-[#13795b] px-4 text-xs font-bold text-white">{saving && <Spinner />} {editing ? "Save changes" : "Create location"}</button></div></form></ModalShell>;
}

function ServiceModal({ value, locations, onClose, onSaved }: { value: ServiceRow | "new"; locations: LocationRow[]; onClose: () => void; onSaved: () => void }) {
  const editing = value !== "new"; const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); const form = Object.fromEntries(new FormData(event.currentTarget)); const response = await fetch(editing ? `/api/services/${value.id}` : "/api/services", { method: editing ? "PATCH" : "POST", credentials: "include", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(form) }); if (!response.ok) { const body = await response.json(); setError(body.error || "Could not save service."); setSaving(false); } else onSaved(); }
  return <ModalShell title={editing ? "Edit service" : "Add a service"} subtitle="Set customer expectations and team capacity." onClose={onClose}><form onSubmit={submit} className="p-5"><label className="text-[10px] font-bold text-[#56655f]">SERVICE NAME<input name="name" required defaultValue={editing ? value.name : ""} placeholder="e.g. General consultation" className={fieldClass()} /></label><label className="mt-4 block text-[10px] font-bold text-[#56655f]">DESCRIPTION<textarea name="description" defaultValue={editing ? value.description ?? "" : ""} placeholder="What should customers expect?" className="mt-1.5 min-h-20 w-full resize-none rounded-xl border border-[#dce3df] p-3.5 text-xs outline-none focus:border-[#4b947b]" /></label><label className="mt-4 block text-[10px] font-bold text-[#56655f]">LOCATION<select name="establishmentId" required defaultValue={editing ? value.establishmentId : locations[0]?.id} className={fieldClass()}>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><div className="mt-4 grid grid-cols-3 gap-3"><label className="text-[10px] font-bold text-[#56655f]">MINUTES<input name="durationMinutes" type="number" min="1" defaultValue={editing ? value.durationMinutes : 10} className={fieldClass()} /></label><label className="text-[10px] font-bold text-[#56655f]">CAPACITY<input name="capacity" type="number" min="1" defaultValue={editing ? value.capacity : 1} className={fieldClass()} /></label><label className="text-[10px] font-bold text-[#56655f]">COLOR<select name="color" defaultValue={editing ? value.color : "emerald"} className={fieldClass()}><option value="emerald">Green</option><option value="blue">Blue</option><option value="violet">Violet</option><option value="amber">Amber</option></select></label></div>{locations.length === 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Create a location before adding a service.</p>}{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="h-10 rounded-xl border border-[#dce3df] px-4 text-xs font-semibold">Cancel</button><button disabled={saving || locations.length === 0} className="flex h-10 items-center gap-2 rounded-xl bg-[#13795b] px-4 text-xs font-bold text-white disabled:opacity-50">{saving && <Spinner />} {editing ? "Save changes" : "Create service"}</button></div></form></ModalShell>;
}

function WalkInModal({ locations, services, onClose, onSaved }: { locations: LocationRow[]; services: ServiceRow[]; onClose: () => void; onSaved: () => void }) {
  const [establishmentId, setEstablishmentId] = useState<number>(locations[0]?.id ?? 0);
  const [serviceId, setServiceId] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const availableServices = services.filter((s) => s.establishmentId === establishmentId && s.active);
  useEffect(() => { setServiceId(availableServices[0]?.id ?? 0); }, [establishmentId]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceId) { setError("Choose a service for this walk-in."); return; }
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/tickets/walkin", { method: "POST", credentials: "include", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ customerName: form.get("customerName"), phone: form.get("phone"), partySize: Number(form.get("partySize")) || 1, serviceId }) });
    if (!response.ok) { const body = await response.json(); setError(body.error || "Couldn’t add walk-in."); setSaving(false); } else onSaved();
  }
  return <ModalShell title="Add walk-in customer" subtitle="Create a queue ticket on the spot — no GPS or location check required." onClose={onClose}><form onSubmit={submit} className="p-5">{locations.length === 0 ? <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Add a location before adding walk-ins.</p> : <><label className="text-[10px] font-bold text-[#56655f]">LOCATION<select value={establishmentId} onChange={(e) => setEstablishmentId(Number(e.target.value))} className={fieldClass()}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.status === "paused" ? " · paused" : l.status === "closed" ? " · closed" : ""}</option>)}</select></label><label className="mt-4 block text-[10px] font-bold text-[#56655f]">SERVICE<select value={serviceId} onChange={(e) => setServiceId(Number(e.target.value))} className={fieldClass()}>{availableServices.length === 0 ? <option value={0}>No active services</option> : availableServices.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.durationMinutes}m</option>)}</select></label><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-[10px] font-bold text-[#56655f]">CUSTOMER NAME<input name="customerName" required placeholder="e.g. Walk-in guest" className={fieldClass()} /></label><label className="text-[10px] font-bold text-[#56655f]">PARTY SIZE<input name="partySize" type="number" min={1} max={10} defaultValue={1} className={fieldClass()} /></label></div><label className="mt-4 block text-[10px] font-bold text-[#56655f]">MOBILE <span className="font-normal text-[#9aa49f]">(optional)</span><input name="phone" type="tel" placeholder="For queue alerts" className={fieldClass()} /></label></>}{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="h-10 rounded-xl border border-[#dce3df] px-4 text-xs font-semibold">Cancel</button><button disabled={saving || locations.length === 0 || availableServices.length === 0} className="flex h-10 items-center gap-2 rounded-xl bg-[#13795b] px-4 text-xs font-bold text-white disabled:opacity-50">{saving && <Spinner />} Add to queue</button></div></form></ModalShell>;
}

function DeleteModal({ item, onClose, onDelete }: { item: { kind: string; id: number; name: string }; onClose: () => void; onDelete: () => void }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-[#10281f]/50 p-5 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center soft-shadow"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600"><Trash2 size={20} /></span><h2 className="mt-4 text-lg font-semibold">Delete {item.name}?</h2><p className="mt-2 text-xs leading-5 text-[#798681]">This action can’t be undone. Related queue records may also be removed.</p><div className="mt-6 grid grid-cols-2 gap-2"><button onClick={onClose} className="h-10 rounded-xl border border-[#dce3df] text-xs font-semibold">Keep it</button><button onClick={onDelete} className="h-10 rounded-xl bg-red-600 text-xs font-bold text-white">Delete</button></div></div></div>;
}
