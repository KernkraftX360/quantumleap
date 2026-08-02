export type CategoryId =
  | "medical"
  | "finance"
  | "food_beverage"
  | "government"
  | "telecom"
  | "retail"
  | "automotive";

export type CategoryMeta = {
  id: CategoryId;
  label: string;
  iconKey: string;
  accent: string;
  blurb: string;
};

export const CATEGORIES: CategoryMeta[] = [
  { id: "medical", label: "Medical", iconKey: "stethoscope", accent: "emerald", blurb: "Hospitals, clinics & pharmacies" },
  { id: "finance", label: "Finance", iconKey: "landmark", accent: "blue", blurb: "Banks, loans & counter services" },
  { id: "food_beverage", label: "Food & Beverage", iconKey: "utensils", accent: "amber", blurb: "Dine-in, takeaway & cafés" },
  { id: "government", label: "Government", iconKey: "scroll", accent: "violet", blurb: "JPJ, immigration & public offices" },
  { id: "telecom", label: "Telecom", iconKey: "smartphone", accent: "cyan", blurb: "Mobile plans, billing & devices" },
  { id: "retail", label: "Retail", iconKey: "bag", accent: "rose", blurb: "Service desks & click-and-collect" },
  { id: "automotive", label: "Automotive", iconKey: "car", accent: "orange", blurb: "Servicing, inspection & parts" },
];

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string | null | undefined): CategoryMeta {
  return byId.get((id ?? "") as CategoryId) ?? CATEGORIES[0];
}

export function isCategoryId(value: string): value is CategoryId {
  return byId.has(value as CategoryId);
}

// Static Tailwind class strings per accent (kept literal so the compiler keeps them).
export const CATEGORY_COLORS: Record<
  string,
  { soft: string; text: string; solid: string; dot: string; ring: string }
> = {
  emerald: { soft: "bg-emerald-50", text: "text-emerald-700", solid: "bg-emerald-600", dot: "bg-emerald-500", ring: "ring-emerald-200" },
  blue: { soft: "bg-blue-50", text: "text-blue-700", solid: "bg-blue-600", dot: "bg-blue-500", ring: "ring-blue-200" },
  amber: { soft: "bg-amber-50", text: "text-amber-700", solid: "bg-amber-600", dot: "bg-amber-500", ring: "ring-amber-200" },
  violet: { soft: "bg-violet-50", text: "text-violet-700", solid: "bg-violet-600", dot: "bg-violet-500", ring: "ring-violet-200" },
  cyan: { soft: "bg-cyan-50", text: "text-cyan-700", solid: "bg-cyan-600", dot: "bg-cyan-500", ring: "ring-cyan-200" },
  orange: { soft: "bg-orange-50", text: "text-orange-700", solid: "bg-orange-600", dot: "bg-orange-500", ring: "ring-orange-200" },
  rose: { soft: "bg-rose-50", text: "text-rose-700", solid: "bg-rose-600", dot: "bg-rose-500", ring: "ring-rose-200" },
};

export type ServiceTemplate = {
  name: string;
  description: string;
  durationMinutes: number;
  capacity: number;
  color: string;
};

// Queue services offered by each non-medical category (medical keeps its kind-based menus in the seed).
export const SERVICE_TEMPLATES: Record<CategoryId, ServiceTemplate[]> = {
  medical: [
    { name: "General consultation", description: "Walk-in or booked consultation with a practitioner", durationMinutes: 15, capacity: 2, color: "emerald" },
    { name: "Specialist referral", description: "Review with a resident specialist", durationMinutes: 22, capacity: 2, color: "blue" },
    { name: "Pharmacy & lab", description: "Prescription collection and sample drop-off", durationMinutes: 9, capacity: 3, color: "amber" },
  ],
  finance: [
    { name: "Counter services", description: "Deposits, withdrawals & cashier transactions", durationMinutes: 12, capacity: 4, color: "blue" },
    { name: "Account opening", description: "New savings, current & joint accounts", durationMinutes: 20, capacity: 2, color: "emerald" },
    { name: "Loan & financing", description: "Personal, home & vehicle financing consults", durationMinutes: 25, capacity: 2, color: "violet" },
  ],
  food_beverage: [
    { name: "Dine-in", description: "Seated table queue", durationMinutes: 30, capacity: 5, color: "amber" },
    { name: "Takeaway", description: "Pick-up order queue", durationMinutes: 8, capacity: 3, color: "emerald" },
    { name: "Reservation check-in", description: "Arrival for a booked table", durationMinutes: 5, capacity: 2, color: "blue" },
  ],
  government: [
    { name: "Counter services", description: "General public counter transactions", durationMinutes: 15, capacity: 4, color: "violet" },
    { name: "Document submission", description: "Forms, applications & renewals", durationMinutes: 10, capacity: 3, color: "blue" },
    { name: "Appointment check-in", description: "Pre-booked appointment arrivals", durationMinutes: 6, capacity: 2, color: "emerald" },
  ],
  telecom: [
    { name: "Plan & SIM services", description: "New lines, upgrades & SIM swaps", durationMinutes: 12, capacity: 3, color: "cyan" },
    { name: "Billing & payments", description: "Bill settlement & account queries", durationMinutes: 7, capacity: 3, color: "emerald" },
    { name: "Device support", description: "Handset setup & warranty assistance", durationMinutes: 18, capacity: 2, color: "amber" },
  ],
  retail: [
    { name: "Customer service", description: "Enquiries, membership & complaints", durationMinutes: 12, capacity: 3, color: "rose" },
    { name: "Click & collect", description: "Online order pick-up counter", durationMinutes: 6, capacity: 2, color: "emerald" },
    { name: "Returns & warranty", description: "Refunds, exchanges & warranty claims", durationMinutes: 15, capacity: 2, color: "blue" },
  ],
  automotive: [
    { name: "Service booking", description: "Scheduled maintenance check-in", durationMinutes: 20, capacity: 3, color: "orange" },
    { name: "Vehicle inspection", description: "Walk-in safety & diagnostic inspection", durationMinutes: 30, capacity: 2, color: "blue" },
    { name: "Parts & accessories", description: "Parts counter & accessory fitting", durationMinutes: 10, capacity: 2, color: "emerald" },
  ],
};
