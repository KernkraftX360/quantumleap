"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crosshair,
  Landmark,
  LocateFixed,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  Route,
  ScrollText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  ShoppingBag,
  Stethoscope,
  Ticket,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Brand, BrandWordmark } from "@/components/brand";
import { Spinner } from "@/components/spinner";
import { haversineKm, MAX_JOIN_DISTANCE_KM, type Coordinates } from "@/lib/geofence";
import { signOut } from "@/lib/signout";
import { CATEGORIES, CATEGORY_COLORS, getCategory, type CategoryId } from "@/lib/categories";
import { authHeaders } from "@/lib/authed-fetch";

type ServiceItem = {
  id: number;
  name: string;
  description: string | null;
  durationMinutes: number;
  capacity: number;
  color: string;
};

type LocationItem = {
  id: number;
  name: string;
  slug: string;
  address: string;
  latitude: string;
  longitude: string;
  phone: string | null;
  status: string;
  openingTime: string;
  closingTime: string;
  state: string | null;
  category: string;
  peopleWaiting: number;
  services: ServiceItem[];
};

type RouteEstimate = { distanceKm: number; travelMinutes: number; provider: string; trafficAware: boolean };

const tone: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700",
  blue: "bg-blue-50 text-blue-700",
  violet: "bg-violet-50 text-violet-700",
  amber: "bg-amber-50 text-amber-700",
  cyan: "bg-cyan-50 text-cyan-700",
  orange: "bg-orange-50 text-orange-700",
  rose: "bg-rose-50 text-rose-700",
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

const CAT_ICONS: Record<string, typeof Building2> = {
  stethoscope: Stethoscope,
  landmark: Landmark,
  utensils: UtensilsCrossed,
  scroll: ScrollText,
  smartphone: Smartphone,
  bag: ShoppingBag,
  car: Car,
};

export function CustomerHome({ user }: { user: { name: string; role: string } | null }) {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [userState, setUserState] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationMessage, setLocationMessage] = useState("Finding your location and state…");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | "all">("all");
  const [selected, setSelected] = useState<LocationItem | null>(null);
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [route, setRoute] = useState<RouteEstimate | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [savedTicket, setSavedTicket] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  function requestLocation() {
    setLocating(true);
    setCoords(null);
    setUserState(null);
    setLocations([]);
    setSelected(null);
    setSelectedCategory("all");
    setLocationMessage("Finding your location and state…");
    if (!navigator.geolocation) {
      setLocating(false);
      setLocationMessage("GPS unavailable · establishments are hidden");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCoords(nextCoords);
        void (async () => {
          try {
            const response = await fetch("/api/locations/nearby", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(nextCoords),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "State verification failed.");
            setUserState(result.state);
            setLocations(result.locations);
            setSelectedCategory("all");
            setLocationMessage(`${result.state} · ${result.locations.length} establishments`);
          } catch (caught) {
            setCoords(null);
            setUserState(null);
            setLocations([]);
            setLocationMessage(caught instanceof Error ? caught.message : "Couldn’t verify your state · tap to retry");
          } finally {
            setLocating(false);
          }
        })();
      },
      (positionError) => {
        setCoords(null);
        setUserState(null);
        setLocations([]);
        setLocating(false);
        setLocationMessage(
          positionError.code === positionError.PERMISSION_DENIED
            ? "GPS permission required · tap to retry"
            : "Couldn’t verify GPS · tap to retry",
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }

  useEffect(() => {
    setSavedTicket(localStorage.getItem("quantum_leap_active_ticket"));
    requestLocation();
  }, []);

  const sortedLocations = useMemo(() => {
    if (!coords || !userState) return [];
    return locations
      .filter((item) => item.state === userState)
      .map((item) => ({
        ...item,
        directDistance: haversineKm(coords, { latitude: Number(item.latitude), longitude: Number(item.longitude) }),
      }))
      .sort((a, b) => a.directDistance - b.directDistance);
  }, [coords, locations, userState]);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of locations) m.set(l.category, (m.get(l.category) ?? 0) + 1);
    return m;
  }, [locations]);

  const filteredLocations = useMemo(
    () => (selectedCategory === "all" ? sortedLocations : sortedLocations.filter((l) => l.category === selectedCategory)),
    [sortedLocations, selectedCategory],
  );

  const activeCategoryMeta = selectedCategory === "all" ? null : getCategory(selectedCategory);
  const emptyCatColors = activeCategoryMeta ? CATEGORY_COLORS[activeCategoryMeta.accent] ?? CATEGORY_COLORS.emerald : CATEGORY_COLORS.emerald;
  const EmptyCatIcon = activeCategoryMeta ? CAT_ICONS[activeCategoryMeta.iconKey] ?? Building2 : Building2;

  const railRef = useRef<HTMLDivElement>(null);
  const [railScroll, setRailScroll] = useState({ left: false, right: false });
  const updateRailScroll = () => {
    const el = railRef.current;
    if (!el) return;
    setRailScroll({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    updateRailScroll();
    const onResize = () => updateRailScroll();
    window.addEventListener("resize", onResize);
    const onWheel = (e: WheelEvent) => {
      const target = railRef.current;
      if (!target || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const atStart = target.scrollLeft <= 0;
      const atEnd = target.scrollLeft + target.clientWidth >= target.scrollWidth - 1;
      if ((e.deltaY < 0 && !atStart) || (e.deltaY > 0 && !atEnd)) {
        target.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    const raf = requestAnimationFrame(updateRailScroll);
    return () => {
      window.removeEventListener("resize", onResize);
      el.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(raf);
    };
  }, [userState, locations, selectedCategory]);

  async function openJoin(location: LocationItem) {
    if (!coords) {
      setLocationMessage("GPS verification is required before joining");
      requestLocation();
      return;
    }
    const distanceKm = haversineKm(coords, {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
    });
    if (distanceKm > MAX_JOIN_DISTANCE_KM) {
      setLocationMessage(`You’re ${distanceKm.toFixed(1)} km away · maximum is ${MAX_JOIN_DISTANCE_KM} km`);
      return;
    }

    setSelected(location);
    setSelectedService(location.services[0]?.id ?? null);
    setRoute(null);
    setError("");
    setRouteLoading(true);
    try {
      const response = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: coords,
          destination: { latitude: Number(location.latitude), longitude: Number(location.longitude) },
        }),
      });
      if (response.ok) setRoute(await response.json());
    } finally {
      setRouteLoading(false);
    }
  }

  async function joinQueue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedService || !selected) return;
    if (!coords) {
      setError("GPS verification was lost. Close this window, enable location access, and try again.");
      return;
    }
    const distanceKm = haversineKm(coords, {
      latitude: Number(selected.latitude),
      longitude: Number(selected.longitude),
    });
    if (distanceKm > MAX_JOIN_DISTANCE_KM) {
      setError(`You must be within ${MAX_JOIN_DISTANCE_KM} km of this establishment to join its queue.`);
      return;
    }
    setJoining(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          customerName: form.get("name"),
          phone: form.get("phone"),
          partySize: Number(form.get("partySize")),
          serviceId: selectedService,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not join the queue.");
      localStorage.setItem("quantum_leap_active_ticket", result.publicId);
      router.push(`/ticket/${result.publicId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join the queue.");
      setJoining(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9f8] pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <Brand />
          <nav className="hidden items-center gap-8 text-sm font-medium text-[#5d6c67] md:flex">
            <a href="#nearby" className="transition hover:text-[#13795b]">Find a queue</a>
            <a href="#how" className="transition hover:text-[#13795b]">How it works</a>
            {user ? (
              <>
                <Link href="/dashboard" className="btnlink border border-[#dfe5e2] text-[#23332e] transition hover:border-[#13795b] hover:text-[#13795b]"><span className="grid size-6 place-items-center rounded-full bg-[#e8f5ef] text-[9px] font-bold text-[#13795b]">{initials(user.name)}</span><span className="hidden sm:inline">{user.name.split(" ")[0]}</span></Link>
                <button onClick={() => signOut()} className="inline-flex items-center gap-1.5 rounded-xl border border-[#ecd9d9] bg-rose-50 px-3 py-2 text-xs font-bold text-[#b04a4a] transition hover:bg-rose-100"><LogOut size={15} /> <span className="hidden sm:inline">Sign out</span></button>
              </>
            ) : (
              <Link href="/login" className="btnlink border border-[#dfe5e2] text-[#23332e] transition hover:border-[#13795b] hover:text-[#13795b]">Business login</Link>
            )}
          </nav>
          <button onClick={() => setMobileMenu(!mobileMenu)} className="grid size-10 place-items-center rounded-xl border border-[#e3e8e5] bg-white md:hidden" aria-label="Open menu">
            {mobileMenu ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
        {mobileMenu && (
          <div className="animate-fade-up border-t border-[#edf0ee] bg-white px-5 py-4 md:hidden">
            <a onClick={() => setMobileMenu(false)} href="#nearby" className="block py-3 text-sm font-medium">Find a queue</a>
            <a onClick={() => setMobileMenu(false)} href="#how" className="block py-3 text-sm font-medium">How it works</a>
            {user ? (
              <>
                <Link onClick={() => setMobileMenu(false)} href="/dashboard" className="btnlink mt-2 w-full bg-[#123e32] text-white">Go to dashboard</Link>
                <button onClick={() => { setMobileMenu(false); signOut(); }} className="mt-2 block w-full rounded-xl border border-[#ecd9d9] bg-rose-50 px-4 py-3 text-center text-sm font-semibold text-[#b04a4a]">Sign out</button>
              </>
            ) : (
              <Link href="/login" className="btnlink mt-2 w-full bg-[#123e32] text-white">Business login</Link>
            )}
          </div>
        )}
      </header>

      <section className="relative overflow-hidden bg-[#103c31] text-white">
        <div className="absolute -right-32 -top-40 size-[520px] rounded-full bg-[#2a8b6c]/35 blur-3xl" />
        <div className="absolute -bottom-52 left-1/3 size-96 rounded-full bg-[#4fb98c]/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 md:min-h-[520px] md:grid-cols-[1.05fr_.95fr] md:px-8 md:py-20">
          <div className="max-w-2xl animate-fade-up">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-medium text-emerald-50">
              <Sparkles size={14} /> Less waiting. More living.
            </div>
            <h1 className="text-[42px] font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-[68px]">
              Your time is yours.<br /><span className="text-[#8fe0bd]">Keep it that way.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-emerald-50/75 sm:text-lg">
              Join the line from wherever you are. Pick a category — medical, banking, dining and more — and we time your arrival to the minute.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#nearby" className="btnlink bg-white text-[#124737] shadow-lg transition hover:-translate-y-0.5">
                Find a queue near me <ArrowRight size={13} />
              </a>
              {savedTicket && (
                <Link href={`/ticket/${savedTicket}`} className="inline-flex h-12 items-center gap-2 rounded-xl btnlink border border-white/20 bg-white/10 text-white transition hover:bg-white/15">
                  <Ticket size={13} /> View my place
                </Link>
              )}
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs text-emerald-50/65">
              <span className="flex items-center gap-2"><Check className="text-[#8fe0bd]" size={15} /> No app needed</span>
              <span className="flex items-center gap-2"><Check className="text-[#8fe0bd]" size={15} /> Live arrival guidance</span>
              <span className="flex items-center gap-2"><Check className="text-[#8fe0bd]" size={15} /> Free to join</span>
            </div>
          </div>

          <div className="relative mx-auto hidden w-full max-w-[430px] md:block">
            <div className="absolute -left-14 top-24 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md">
              <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#8fe0bd] text-[#103c31]"><Navigation size={17} /></span><div><p className="text-[10px] text-white/60">LEAVE IN</p><p className="text-lg font-bold">12 min</p></div></div>
            </div>
            <div className="soft-shadow rotate-[2deg] rounded-[32px] border-[7px] border-[#0b2c24] bg-[#f7f9f8] p-3 text-[#12231e]">
              <div className="rounded-[22px] bg-white p-5">
                <div className="flex items-center justify-between"><Brand compact /><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">LIVE</span></div>
                <div className="mt-7 rounded-3xl bg-[#eaf6f0] p-6 text-center">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#5a756b]">Your number</p>
                  <p className="mt-2 text-6xl font-bold tracking-[-0.06em] text-[#125a44]">A153</p>
                  <p className="mt-3 text-sm text-[#557268]">3 people ahead of you</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[#e7ece9] p-4"><Clock3 size={17} className="text-[#16805e]" /><p className="mt-3 text-xl font-bold">~18 min</p><p className="mt-1 text-[11px] text-[#81908a]">EST. WAIT</p></div>
                  <div className="rounded-2xl border border-[#e7ece9] p-4"><Route size={17} className="text-[#16805e]" /><p className="mt-3 text-xl font-bold">8 min</p><p className="mt-1 text-[11px] text-[#81908a]">TRAVEL</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="nearby" className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#16805e]">{userState ? `${userState} · ${selectedCategory === "all" ? "All categories" : getCategory(selectedCategory).label}` : "Near you"}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#172721] md:text-[40px]">Find your nearest queue</h2>
            <p className="mt-2 text-sm text-[#72807a]">Choose a category, then join any queue in your GPS state within {MAX_JOIN_DISTANCE_KM} km of you.</p>
          </div>
          <button onClick={requestLocation} className="focus-ring inline-flex w-fit items-center gap-2 rounded-xl border border-[#dfe5e2] bg-white px-4 py-3 text-sm font-semibold text-[#34443f] card-shadow">
            {locating ? <Spinner /> : <LocateFixed size={16} className="text-[#16805e]" />} {locationMessage}
          </button>
        </div>

        <div className="relative mb-7">
          <div aria-hidden className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#f7f9f8] to-transparent transition-opacity duration-300 ${railScroll.left ? "opacity-100" : "opacity-0"}`} />
          <div aria-hidden className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#f7f9f8] to-transparent transition-opacity duration-300 ${railScroll.right ? "opacity-100" : "opacity-0"}`} />
          <button type="button" aria-label="Scroll categories left" onClick={() => railRef.current?.scrollBy({ left: -260, behavior: "smooth" })} className={`focus-ring absolute left-0 top-1/2 z-20 hidden size-8 -translate-y-1/2 place-items-center rounded-full border border-[#e1e7e4] bg-white text-[#465650] shadow-sm transition hover:border-[#13795b] hover:text-[#13795b] sm:grid ${railScroll.left ? "" : "pointer-events-none opacity-0"}`}><ChevronLeft size={16} /></button>
          <button type="button" aria-label="Scroll categories right" onClick={() => railRef.current?.scrollBy({ left: 260, behavior: "smooth" })} className={`focus-ring absolute right-0 top-1/2 z-20 hidden size-8 -translate-y-1/2 place-items-center rounded-full border border-[#e1e7e4] bg-white text-[#465650] shadow-sm transition hover:border-[#13795b] hover:text-[#13795b] sm:grid ${railScroll.right ? "" : "pointer-events-none opacity-0"}`}><ChevronRight size={16} /></button>
          <div ref={railRef} onScroll={updateRailScroll} className="flex gap-2 overflow-x-auto hide-scrollbar scroll-smooth pb-1">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`focus-ring flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-bold transition ${selectedCategory === "all" ? "border-transparent bg-[#123e32] text-white shadow-sm" : "border-[#e1e7e4] bg-white text-[#465650] hover:border-[#b8ccc3]"}`}
          >
            <span className={`grid size-5 place-items-center rounded-full ${selectedCategory === "all" ? "bg-white/20" : "bg-[#e8f5ef]"}`}><Sparkles size={12} className={selectedCategory === "all" ? "text-white" : "text-[#13795b]"} /></span>
            <span>All categories</span>
            {userState && <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${selectedCategory === "all" ? "bg-white/20" : "bg-[#eef2f0] text-[#5a6862]"}`}>{locations.length}</span>}
          </button>
          {CATEGORIES.map((c) => {
            const cc = CATEGORY_COLORS[c.accent] ?? CATEGORY_COLORS.emerald;
            const Icon = CAT_ICONS[c.iconKey] ?? Building2;
            const active = selectedCategory === c.id;
            const count = userState ? categoryCounts.get(c.id) ?? 0 : null;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                title={c.blurb}
                className={`focus-ring flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-bold transition ${active ? `border-transparent ${cc.solid} text-white shadow-sm` : "border-[#e1e7e4] bg-white text-[#465650] hover:border-[#b8ccc3]"}`}
              >
                <span className={`grid size-5 place-items-center rounded-full ${active ? "bg-white/20" : cc.soft}`}><Icon size={12} className={active ? "text-white" : cc.text} /></span>
                <span>{c.label}</span>
                {count !== null && <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${active ? "bg-white/20" : `${cc.soft} ${cc.text}`}`}>{count}</span>}
              </button>
            );
          })}
          </div>
        </div>

        {locating ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="animate-pulse-soft rounded-2xl border border-[#e2e8e5] bg-white p-5 card-shadow">
                <div className="flex justify-between"><div className="size-11 rounded-2xl bg-[#e9efec]" /><div className="h-6 w-16 rounded-full bg-[#edf1ef]" /></div>
                <div className="mt-5 h-5 w-2/3 rounded bg-[#e9efec]" />
                <div className="mt-3 h-3 w-full rounded bg-[#f0f3f1]" />
                <div className="mt-2 h-3 w-4/5 rounded bg-[#f0f3f1]" />
                <div className="mt-5 h-16 rounded-xl bg-[#f3f5f4]" />
                <div className="mt-5 h-11 rounded-xl bg-[#e9efec]" />
              </div>
            ))}
          </div>
        ) : !coords || !userState ? (
          <div className="rounded-3xl border border-dashed border-[#d8dfdb] bg-white px-6 py-16 text-center">
            <LocateFixed className="mx-auto text-[#8aa097]" />
            <h3 className="mt-4 font-semibold">GPS state verification is required</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#78847f]">Establishments stay hidden until your GPS location is matched to a Malaysian state. Pick a category above once verified.</p>
            <button onClick={requestLocation} className="mt-5 rounded-xl bg-[#13795b] px-4 py-2.5 text-xs font-bold text-white">Try GPS again</button>
          </div>
        ) : sortedLocations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#d8dfdb] bg-white px-6 py-16 text-center">
            <Building2 className="mx-auto text-[#8aa097]" />
            <h3 className="mt-4 font-semibold">No establishments in {userState}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#78847f]">Only establishments in your GPS-detected state are shown. New locations will appear here when available.</p>
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#d8dfdb] bg-white px-6 py-16 text-center">
            <span className={`mx-auto grid size-12 place-items-center rounded-2xl ${emptyCatColors.soft} ${emptyCatColors.text}`}><EmptyCatIcon size={22} /></span>
            <h3 className="mt-4 font-semibold">No {getCategory(selectedCategory).label} queues in {userState}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#78847f]">There are no {getCategory(selectedCategory).label.toLowerCase()} establishments in your state yet. Try another category.</p>
            <button onClick={() => setSelectedCategory("all")} className="mt-5 rounded-xl bg-[#13795b] px-4 py-2.5 text-xs font-bold text-white">Show all categories</button>
          </div>
        ) : (
          <div key={`${userState}-${selectedCategory}`} className="grid animate-fade-up gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredLocations.map((location) => {
              const averageDuration = location.services.length ? Math.round(location.services.reduce((sum, service) => sum + service.durationMinutes, 0) / location.services.length) : 10;
              const estimatedWait = Math.max(3, Math.ceil((location.peopleWaiting * averageDuration) / Math.max(2, location.services.length)));
              const withinJoinRadius = location.directDistance !== null && location.directDistance <= MAX_JOIN_DISTANCE_KM;
              const outsideJoinRadius = location.directDistance !== null && !withinJoinRadius;
              const joinDisabled = locating || location.services.length === 0 || outsideJoinRadius || location.status === "paused" || location.status === "closed";
              const cat = getCategory(location.category);
              const CatIcon = CAT_ICONS[cat.iconKey] ?? Building2;
              const cc = CATEGORY_COLORS[cat.accent] ?? CATEGORY_COLORS.emerald;
              return (
                <article key={location.id} className="group flex flex-col overflow-hidden rounded-2xl border border-[#e2e8e5] bg-white p-5 card-shadow transition duration-300 hover:-translate-y-1 hover:border-[#b8d7ca] hover:shadow-[0_18px_45px_rgba(18,68,53,.1)]">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`grid size-11 place-items-center rounded-2xl ${cc.soft} ${cc.text}`}><CatIcon size={20} /></span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${location.status === "paused" ? "bg-amber-100 text-amber-800" : location.status === "closed" ? "bg-red-50 text-red-700" : location.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><span className="size-1.5 rounded-full bg-current" /> {location.status === "open" ? "Open" : location.status === "paused" ? "Paused" : location.status === "closed" ? "Closed" : "High demand"}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em]">{location.name}</h3>
                  <div className="mt-2"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cc.soft} ${cc.text}`}><CatIcon size={11} />{cat.label}</span></div>
                  <p className="mt-2 flex min-h-10 items-start gap-1.5 text-xs leading-5 text-[#77837e]"><MapPin size={14} className="mt-0.5 shrink-0" /> {location.address}</p>
                  <div className="mt-5 grid grid-cols-3 divide-x divide-[#e8ecea] rounded-xl bg-[#f7f9f8] px-2 py-3 text-center">
                    <div><p className="text-base font-bold text-[#263630]">{location.peopleWaiting}</p><p className="mt-0.5 text-[10px] uppercase tracking-wide text-[#8a9691]">in line</p></div>
                    <div><p className="text-base font-bold text-[#263630]">~{estimatedWait}</p><p className="mt-0.5 text-[10px] uppercase tracking-wide text-[#8a9691]">min wait</p></div>
                    <div><p className="text-base font-bold text-[#263630]">{location.directDistance === null ? "—" : location.directDistance < 1 ? `${Math.round(location.directDistance * 1000)}m` : `${location.directDistance.toFixed(1)}km`}</p><p className="mt-0.5 text-[10px] uppercase tracking-wide text-[#8a9691]">away</p></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {location.services.slice(0, 2).map((service) => <span key={service.id} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${tone[service.color] ?? tone.emerald}`}>{service.name}</span>)}
                    {location.services.length > 2 && <span className="rounded-lg bg-[#f2f4f3] px-2.5 py-1.5 text-[11px] font-medium text-[#6c7873]">+{location.services.length - 2}</span>}
                  </div>
                  <button disabled={joinDisabled} onClick={() => openJoin(location)} className={`focus-ring mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed ${outsideJoinRadius ? "bg-red-50 text-red-700" : "bg-[#123e32] text-white group-hover:bg-[#13795b] disabled:opacity-45"}`}>
                    {locating ? (
                      <><Spinner /> Checking GPS…</>
                    ) : location.services.length === 0 ? (
                      "Queue unavailable"
                    ) : location.status === "paused" || location.status === "closed" ? (
                      <>{location.status === "paused" ? "Queue paused" : "Closed"}</>
                    ) : outsideJoinRadius ? (
                      <>Outside {MAX_JOIN_DISTANCE_KM} km radius</>
                    ) : !coords ? (
                      <><LocateFixed size={16} /> Enable GPS to join</>
                    ) : (
                      <>Join this queue <ChevronRight size={16} /></>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section id="how" className="border-y border-[#e4e9e6] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-xl text-center"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#16805e]">Simple by design</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Wait less in three steps</h2></div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              [Crosshair, "01", "Share your location", "We use your browser’s GPS to find queues nearby. Your location is only used for this trip."],
              [Ticket, "02", "Reserve your place", "Choose a service and get a queue number instantly—no account or download required."],
              [Navigation, "03", "Arrive right on time", "Live wait and route estimates tell you exactly when to leave, then update as the line moves."],
            ].map(([Icon, number, title, copy]) => {
              const StepIcon = Icon as typeof Crosshair;
              return <div key={String(number)} className="relative rounded-2xl border border-[#e5eae7] p-6"><span className="absolute right-5 top-4 text-4xl font-bold text-[#edf1ef]">{String(number)}</span><span className="grid size-11 place-items-center rounded-2xl bg-[#e9f5ef] text-[#13795b]"><StepIcon size={20} /></span><h3 className="mt-5 font-semibold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-[#74817c]">{String(copy)}</p></div>;
            })}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[#7a8782]"><ShieldCheck size={15} className="text-[#16805e]" /> GPS verifies your state and the {MAX_JOIN_DISTANCE_KM} km join radius. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="font-medium text-[#13795b] hover:underline">State data © OpenStreetMap contributors</a></div>
        </div>
      </section>

      <footer className="bg-[#0d2f27] px-5 py-10 text-white md:px-8"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 sm:flex-row"><Brand light /><p className="flex flex-wrap items-center justify-center gap-x-1.5 text-xs text-white/50">© {new Date().getFullYear()} <BrandWordmark className="text-[10px] text-white/65" /><span>· Better queues for everyone.</span></p></div></footer>

      <div className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-[#e1e7e4] bg-white/95 px-3 backdrop-blur md:hidden mobile-safe-bottom">
        <a href="#nearby" className="flex flex-col items-center gap-1 text-[10px] font-semibold text-[#13795b]"><MapPin size={19} /> Nearby</a>
        {savedTicket ? <Link href={`/ticket/${savedTicket}`} className="flex flex-col items-center gap-1 text-[10px] font-medium text-[#708079]"><Ticket size={19} /> My place</Link> : <span className="flex flex-col items-center gap-1 text-[10px] text-[#a0aaa6]"><Ticket size={19} /> My place</span>}
        {user ? <Link href="/dashboard" className="flex flex-col items-center gap-1 text-[10px] font-medium text-[#708079]"><Building2 size={19} /> Dashboard</Link> : <Link href="/login" className="flex flex-col items-center gap-1 text-[10px] font-medium text-[#708079]"><Building2 size={19} /> Business</Link>}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#10281f]/50 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <div className="animate-fade-up max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-lg sm:rounded-[24px]">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#e8ecea] bg-white px-5 py-5 sm:px-6">
              <div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#16805e]">Join remotely</p><h2 className="mt-1 text-xl font-semibold tracking-[-.025em]">{selected.name}</h2></div>
              <button onClick={() => setSelected(null)} className="grid size-9 place-items-center rounded-xl bg-[#f3f5f4] text-[#5f6d68]" aria-label="Close"><X size={18} /></button>
            </div>
            <form onSubmit={joinQueue} className="p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[#edf7f2] p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#13795b]"><Route size={18} /></span>
                {routeLoading ? <div><p className="text-sm font-semibold">Checking the best route…</p><p className="mt-1 text-xs text-[#70817a]">Using live road data</p></div> : route ? <div className="flex flex-1 items-center justify-between"><div><p className="text-sm font-semibold">{route.travelMinutes} min drive · {route.distanceKm} km</p><p className="mt-1 text-xs text-[#70817a]">{route.trafficAware ? "Live traffic included" : "Current route estimate"}</p></div><span className="relative size-2 rounded-full bg-green-500 live-dot" /></div> : <div><p className="text-sm font-semibold">GPS verified within {MAX_JOIN_DISTANCE_KM} km</p><p className="mt-1 text-xs text-[#70817a]">Route estimate is temporarily unavailable</p></div>}
              </div>

              <label className="text-xs font-bold uppercase tracking-[.1em] text-[#65736e]">Choose a service</label>
              <div className="mt-2 grid gap-2">
                {selected.services.map((service) => (
                  <button type="button" key={service.id} onClick={() => setSelectedService(service.id)} className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition ${selectedService === service.id ? "border-[#13795b] bg-[#f0f8f4] ring-1 ring-[#13795b]" : "border-[#e1e7e4] hover:border-[#b8ccc3]"}`}>
                    <span><span className="block text-sm font-semibold">{service.name}</span><span className="mt-0.5 block text-xs text-[#7a8782]">About {service.durationMinutes} min per visit</span></span>
                    <span className={`grid size-5 place-items-center rounded-full border ${selectedService === service.id ? "border-[#13795b] bg-[#13795b] text-white" : "border-[#cbd4d0]"}`}>{selectedService === service.id && <Check size={12} strokeWidth={3} />}</span>
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-[#4b5b55]">Your name<input required name="name" placeholder="e.g. Alex Morgan" className="focus-ring mt-2 h-11 w-full rounded-xl border border-[#dfe5e2] bg-white px-3.5 text-sm outline-none" /></label>
                <label className="text-xs font-semibold text-[#4b5b55]">Mobile number <span className="font-normal text-[#9aa49f]">(optional)</span><input name="phone" type="tel" placeholder="For queue alerts" className="focus-ring mt-2 h-11 w-full rounded-xl border border-[#dfe5e2] bg-white px-3.5 text-sm outline-none" /></label>
              </div>
              <label className="mt-4 block text-xs font-semibold text-[#4b5b55]">Party size<select name="partySize" className="focus-ring mt-2 h-11 w-full rounded-xl border border-[#dfe5e2] bg-white px-3.5 text-sm outline-none"><option value="1">1 person</option><option value="2">2 people</option><option value="3">3 people</option><option value="4">4 people</option><option value="5">5+ people</option></select></label>
              {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3.5 py-3 text-xs font-medium text-red-700">{error}</p>}
              <button disabled={joining || !selectedService} className="focus-ring mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#13795b] text-sm font-bold text-white transition hover:bg-[#0f684e] disabled:opacity-60">
                {joining ? <><Spinner /> Reserving your place…</> : <>Get my queue number <ArrowRight size={16} /></>}
              </button>
              <p className="mt-3 text-center text-[11px] text-[#89948f]">You can leave the queue at any time. No account required.</p>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
