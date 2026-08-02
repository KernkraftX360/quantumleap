import { asc, count, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { establishments, queueTickets, services, users } from "@/db/schema";
import { malaysiaFacilities } from "@/lib/malaysia-facilities";
import { otherEstablishments } from "@/lib/other-establishments";
import { startScheduler } from "@/lib/scheduler";
import { SERVICE_TEMPLATES, getCategory, type CategoryId } from "@/lib/categories";
import { hashPassword } from "@/lib/password";

let seeded = false;

const hospitalServices = [
  {
    name: "Outpatient registration",
    description: "Registration and assessment for general outpatient care",
    durationMinutes: 12,
    capacity: 4,
    color: "emerald",
  },
  {
    name: "Specialist consultation",
    description: "Scheduled review with a hospital specialist",
    durationMinutes: 24,
    capacity: 2,
    color: "blue",
  },
  {
    name: "Pharmacy collection",
    description: "Prescription verification and medicine collection",
    durationMinutes: 8,
    capacity: 3,
    color: "amber",
  },
] as const;

const clinicServices = [
  {
    name: "General consultation",
    description: "Primary care consultation for adults and children",
    durationMinutes: 15,
    capacity: 2,
    color: "emerald",
  },
  {
    name: "Maternal & child health",
    description: "Routine maternal, infant, and child health services",
    durationMinutes: 18,
    capacity: 2,
    color: "violet",
  },
  {
    name: "Health screening",
    description: "Preventive screening and basic health checks",
    durationMinutes: 12,
    capacity: 2,
    color: "blue",
  },
] as const;

const histNames = ["Aisyah Rahman", "Amir Hakim", "Mei Ling Tan", "Arjun Nair", "Nurul Izzati", "Daniel Lee", "Siti Hajar", "Hafiz Ismail", "Priya Menon", "Adam Wong", "Farah Zainal", "Yusuf Lim"];

async function ensureNoShowHistory() {
  const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(queueTickets).where(eq(queueTickets.status, "no_show"));
  if (Number(c.n) > 0) return;
  const locs = await db.select({ id: establishments.id }).from(establishments).orderBy(asc(establishments.id));
  if (!locs.length) return;
  const svcs = await db.select({ id: services.id, establishmentId: services.establishmentId }).from(services);
  const firstSvc = new Map<number, number>();
  for (const s of svcs) if (!firstSvc.has(s.establishmentId)) firstSvc.set(s.establishmentId, s.id);
  const rotation = locs.map((l) => ({ est: l.id, svc: firstSvc.get(l.id) ?? 0 })).filter((x) => x.svc);
  if (!rotation.length) return;
  const hotPool = rotation.slice(0, 6);
  const noShowPattern = [3, 5, 4, 6, 4, 7, 5];
  const completedPattern = [16, 20, 18, 24, 22, 26, 24];
  const cancelledPattern = [1, 2, 1, 2, 1, 3, 2];
  const startToday = new Date();
  startToday.setUTCHours(0, 0, 0, 0);
  const rows: Array<typeof queueTickets.$inferInsert> = [];
  let cIdx = 0;
  let nIdx = 0;
  let xIdx = 0;
  // Build rows day-by-day (kept explicit for clarity of timestamps).
  for (let d = 0; d < 7; d++) {
    const dayBase = startToday.getTime() - d * 86400000;
    const emit = (status: string, n: number, pool: { est: number; svc: number }[], counter: () => number) => {
      for (let i = 0; i < n; i++) {
        const r = pool[counter() % pool.length];
        const joined = dayBase + (9 * 3600 + (i * 7 + d * 3) * 60) * 1000;
        rows.push({
          ticketNumber: `H${String(rows.length + 1).padStart(4, "0")}`,
          customerName: histNames[rows.length % histNames.length],
          establishmentId: r.est,
          serviceId: r.svc,
          status,
          partySize: 1,
          travelMinutes: 0,
          distanceKm: "0.00",
          serviceMinutesSnapshot: 12,
          joinedAt: new Date(joined),
          updatedAt: new Date(joined),
          calledAt: status !== "waiting" ? new Date(joined + 5 * 60000) : null,
          startedAt: status === "serving" || status === "completed" ? new Date(joined + 8 * 60000) : null,
          completedAt: status === "completed" ? new Date(joined + 20 * 60000) : null,
        });
      }
    };
    emit("completed", completedPattern[d], rotation, () => cIdx++);
    emit("no_show", noShowPattern[d], hotPool, () => nIdx++);
    emit("cancelled", cancelledPattern[d], rotation, () => xIdx++);
  }
  await db.insert(queueTickets).values(rows);
}

async function ensureNationwideFacilities() {
  const existingRows = await db.select({ slug: establishments.slug }).from(establishments);
  const existingSlugs = new Set(existingRows.map((row) => row.slug));
  const missingFacilities = malaysiaFacilities.filter((facility) => !existingSlugs.has(facility.slug));
  if (missingFacilities.length === 0) return;

  const patientNames = [
    "Aiman Zulkifli",
    "Siti Nur Aina",
    "Tan Wei Ming",
    "Kavitha Raj",
    "Nur Syafiqah",
    "Lim Jia Hui",
    "Muhammad Irfan",
    "Devi Kumar",
  ];

  await db.transaction(async (tx) => {
    const insertedLocations = await tx
      .insert(establishments)
      .values(
        missingFacilities.map((facility) => ({
          name: facility.name,
          slug: facility.slug,
          address: facility.address,
          latitude: facility.latitude,
          longitude: facility.longitude,
          phone: null,
          status: "open",
          openingTime: facility.kind === "hospital" ? "00:00" : "08:00",
          closingTime: facility.kind === "hospital" ? "23:59" : "17:00",
          accent: facility.accent,
        })),
      )
      .returning();

    const serviceValues = insertedLocations.flatMap((location) => {
      const facility = missingFacilities.find((item) => item.slug === location.slug)!;
      const templates = facility.kind === "hospital" ? hospitalServices : clinicServices;
      return templates.map((service) => ({
        establishmentId: location.id,
        name: service.name,
        description: service.description,
        durationMinutes: service.durationMinutes,
        capacity: service.capacity,
        color: service.color,
      }));
    });
    const insertedServices = await tx.insert(services).values(serviceValues).returning();

    const now = Date.now();
    const demoTickets = insertedLocations.map((location, index) => {
      const firstService = insertedServices.find((service) => service.establishmentId === location.id)!;
      return {
        ticketNumber: `M${String(201 + index).padStart(3, "0")}`,
        customerName: patientNames[index % patientNames.length],
        phone: `+60 1${index % 2 === 0 ? "2" : "1"}-${String(7100 + index).padStart(4, "0")}`,
        establishmentId: location.id,
        serviceId: firstService.id,
        status: "waiting",
        partySize: index % 9 === 0 ? 2 : 1,
        latitude: (Number(location.latitude) + 0.004).toFixed(7),
        longitude: (Number(location.longitude) + 0.004).toFixed(7),
        distanceKm: "0.70",
        travelMinutes: 4,
        serviceMinutesSnapshot: firstService.durationMinutes,
        joinedAt: new Date(now - (18 - (index % 12)) * 60_000),
        updatedAt: new Date(now - (index % 4) * 60_000),
      };
    });
    await tx.insert(queueTickets).values(demoTickets);
  });
}

const categoryHours: Record<string, [string, string]> = {
  finance: ["09:00", "17:00"],
  food_beverage: ["08:00", "22:00"],
  government: ["08:00", "17:00"],
  telecom: ["10:00", "21:00"],
  retail: ["10:00", "22:00"],
  automotive: ["08:30", "18:00"],
};

async function ensureCategoryEstablishments() {
  const grid = otherEstablishments;
  const gridSlugs = new Set(grid.map((entry) => entry.slug));
  const existingRows = await db
    .select({ slug: establishments.slug, category: establishments.category, ownerUserId: establishments.ownerUserId })
    .from(establishments);
  const existingNonMedical = existingRows.filter((row) => row.category !== "medical");
  // Only legacy, unowned approximations are considered stray; owner-claimed (business/admin) establishments are never touched.
  const unownedExtras = existingNonMedical.filter((row) => !gridSlugs.has(row.slug) && row.ownerUserId == null);
  const missingGrid = grid.filter((entry) => !existingRows.some((row) => row.slug === entry.slug));
  if (unownedExtras.length === 0 && missingGrid.length === 0) return;

  const customerNames = ["Wei Jie Lim", "Asha Nair", "Farid Omar", "Chloe Tan", "Ravi Kumar", "Mei Yen Wong", "Danial Aziz", "Soo Min Park"];

  await db.transaction(async (tx) => {
    // Reconcile non-medical establishments to the authentic 2-per-(category, state) grid;
    // medical rows (hospitals & clinics) are never touched.
    if (unownedExtras.length) await tx.delete(establishments).where(inArray(establishments.slug, unownedExtras.map((row) => row.slug)));
    const insertedLocations = await tx
      .insert(establishments)
      .values(
        missingGrid.map((entry) => {
          const cat = getCategory(entry.category);
          const [open, close] = categoryHours[entry.category] ?? ["09:00", "18:00"];
          return {
            name: entry.name,
            slug: entry.slug,
            address: entry.address,
            latitude: entry.latitude,
            longitude: entry.longitude,
            phone: null,
            status: "open",
            openingTime: open,
            closingTime: close,
            accent: cat.accent,
            category: entry.category,
          };
        }),
      )
      .returning();

    const serviceValues = insertedLocations.flatMap((location) => {
      const entry = grid.find((item) => item.slug === location.slug)!;
      const templates = SERVICE_TEMPLATES[entry.category as Exclude<CategoryId, "medical">];
      return templates.map((service) => ({
        establishmentId: location.id,
        name: service.name,
        description: service.description,
        durationMinutes: service.durationMinutes,
        capacity: service.capacity,
        color: service.color,
      }));
    });
    const insertedServices = await tx.insert(services).values(serviceValues).returning();

    const now = Date.now();
    const demoTickets = insertedLocations.map((location, index) => {
      const firstService = insertedServices.find((service) => service.establishmentId === location.id)!;
      const status = index % 6 === 0 ? "serving" : index % 6 === 1 ? "called" : "waiting";
      return {
        ticketNumber: `C${String(301 + index).padStart(3, "0")}`,
        customerName: customerNames[index % customerNames.length],
        phone: `+60 1${index % 2 === 0 ? "3" : "4"}-${String(8200 + index).padStart(4, "0")}`,
        establishmentId: location.id,
        serviceId: firstService.id,
        status,
        partySize: index % 7 === 0 ? 2 : 1,
        latitude: (Number(location.latitude) + 0.003).toFixed(7),
        longitude: (Number(location.longitude) + 0.003).toFixed(7),
        distanceKm: "0.60",
        travelMinutes: 3,
        serviceMinutesSnapshot: firstService.durationMinutes,
        joinedAt: new Date(now - (15 - (index % 10)) * 60_000),
        calledAt: status === "called" || status === "serving" ? new Date(now - 3 * 60_000) : null,
        startedAt: status === "serving" ? new Date(now - 1 * 60_000) : null,
        updatedAt: new Date(now - (index % 4) * 60_000),
      };
    });
    await tx.insert(queueTickets).values(demoTickets);
  });
}

export async function ensureSeeded() {
  if (seeded) return;

  const [userCount] = await db.select({ value: count() }).from(users);
  if (Number(userCount.value) === 0) {
    await db.insert(users).values([
      {
        name: "Maya Chen",
        email: "admin@quantumleap.app",
        passwordHash: hashPassword("demo1234"),
        role: "admin",
      },
      {
        name: "Jordan Ellis",
        email: "jordan@example.com",
        passwordHash: hashPassword("demo1234"),
        role: "customer",
      },
    ]);
  }

  const [locationCount] = await db.select({ value: count() }).from(establishments);
  if (Number(locationCount.value) === 0) {
    const insertedLocations = await db
      .insert(establishments)
      .values([
        {
          name: "Merdeka General Hospital",
          slug: "merdeka-general-hospital",
          address: "Jalan Hang Tuah, 55100 Kuala Lumpur",
          latitude: "3.1416000",
          longitude: "101.7008000",
          phone: "+60 3-2700 1101",
          status: "open",
          openingTime: "00:00",
          closingTime: "23:59",
          accent: "emerald",
        },
        {
          name: "Bangsar Community Hospital",
          slug: "bangsar-community-hospital",
          address: "Jalan Telawi 4, Bangsar Baru, 59100 Kuala Lumpur",
          latitude: "3.1290000",
          longitude: "101.6680000",
          phone: "+60 3-2282 2202",
          status: "open",
          openingTime: "00:00",
          closingTime: "23:59",
          accent: "blue",
        },
        {
          name: "Bukit Bintang Family Clinic",
          slug: "bukit-bintang-family-clinic",
          address: "Jalan Sultan Ismail, Bukit Bintang, 50250 Kuala Lumpur",
          latitude: "3.1478000",
          longitude: "101.7106000",
          phone: "+60 3-2142 3303",
          status: "open",
          openingTime: "08:00",
          closingTime: "21:00",
          accent: "violet",
        },
        {
          name: "Setapak Primary Care Clinic",
          slug: "setapak-primary-care-clinic",
          address: "Jalan Genting Klang, Setapak, 53300 Kuala Lumpur",
          latitude: "3.2007000",
          longitude: "101.7187000",
          phone: "+60 3-4021 4404",
          status: "busy",
          openingTime: "08:00",
          closingTime: "20:00",
          accent: "amber",
        },
      ])
      .returning();

    const [merdekaHospital, bangsarHospital, bukitBintangClinic, setapakClinic] = insertedLocations;
    const insertedServices = await db
      .insert(services)
      .values([
        {
          establishmentId: merdekaHospital.id,
          name: "Outpatient registration",
          description: "Registration and assessment for general outpatient care",
          durationMinutes: 12,
          capacity: 4,
          color: "emerald",
        },
        {
          establishmentId: merdekaHospital.id,
          name: "Emergency triage",
          description: "Initial clinical assessment for urgent cases",
          durationMinutes: 10,
          capacity: 3,
          color: "amber",
        },
        {
          establishmentId: merdekaHospital.id,
          name: "Specialist consultation",
          description: "Scheduled review with a hospital specialist",
          durationMinutes: 24,
          capacity: 2,
          color: "blue",
        },
        {
          establishmentId: bangsarHospital.id,
          name: "General medicine",
          description: "Adult outpatient consultation and follow-up",
          durationMinutes: 18,
          capacity: 3,
          color: "blue",
        },
        {
          establishmentId: bangsarHospital.id,
          name: "Lab & diagnostics",
          description: "Blood tests and routine diagnostic services",
          durationMinutes: 14,
          capacity: 2,
          color: "violet",
        },
        {
          establishmentId: bangsarHospital.id,
          name: "Hospital pharmacy",
          description: "Prescription verification and medicine collection",
          durationMinutes: 7,
          capacity: 3,
          color: "emerald",
        },
        {
          establishmentId: bukitBintangClinic.id,
          name: "GP consultation",
          description: "Same-day consultation with a family doctor",
          durationMinutes: 13,
          capacity: 2,
          color: "violet",
        },
        {
          establishmentId: bukitBintangClinic.id,
          name: "Vaccination",
          description: "Routine immunisation and travel vaccines",
          durationMinutes: 9,
          capacity: 1,
          color: "emerald",
        },
        {
          establishmentId: setapakClinic.id,
          name: "Family medicine",
          description: "Primary care for adults and children",
          durationMinutes: 15,
          capacity: 2,
          color: "amber",
        },
        {
          establishmentId: setapakClinic.id,
          name: "Health screening",
          description: "Preventive screening and basic health checks",
          durationMinutes: 20,
          capacity: 2,
          color: "blue",
        },
      ])
      .returning();

    const now = Date.now();
    const names = [
      "Aisyah Rahman",
      "Amir Hakim",
      "Mei Ling Tan",
      "Arjun Nair",
      "Nurul Izzati",
      "Daniel Lee",
      "Siti Hajar",
      "Hafiz Ismail",
      "Priya Menon",
      "Adam Wong",
      "Farah Zainal",
      "Yusuf Lim",
    ];
    const demoTickets = names.map((name, index) => {
      const service = insertedServices[index % insertedServices.length];
      const location = insertedLocations.find((item) => item.id === service.establishmentId)!;
      const status = index === 0 ? "serving" : index === 1 ? "called" : index > 9 ? "completed" : "waiting";
      return {
        ticketNumber: `A${String(141 + index).padStart(3, "0")}`,
        customerName: name,
        phone: `+60 12-${String(6300 + index).padStart(4, "0")}`,
        establishmentId: location.id,
        serviceId: service.id,
        status,
        partySize: index % 5 === 0 ? 2 : 1,
        latitude: "3.1511000",
        longitude: "101.7019000",
        distanceKm: String((1.1 + index * 0.48).toFixed(2)),
        travelMinutes: 5 + (index % 7) * 2,
        serviceMinutesSnapshot: service.durationMinutes,
        joinedAt: new Date(now - (32 - index * 2) * 60_000),
        calledAt: status === "called" || status === "serving" ? new Date(now - 4 * 60_000) : null,
        startedAt: status === "serving" ? new Date(now - 2 * 60_000) : null,
        completedAt: status === "completed" ? new Date(now - 5 * 60_000) : null,
        updatedAt: new Date(now - (index % 4) * 60_000),
      };
    });
    await db.insert(queueTickets).values(demoTickets);
  }

  await ensureNationwideFacilities();

  await ensureCategoryEstablishments();

  await ensureNoShowHistory();

  const firstLocation = await db.select().from(establishments).orderBy(asc(establishments.id)).limit(1);
  if (firstLocation.length) {
    const locationServices = await db.select().from(services).where(eq(services.establishmentId, firstLocation[0].id));
    if (!locationServices.length) seeded = false;
  }
  startScheduler();
  seeded = true;
}
