import { malaysiaFacilities } from "@/lib/malaysia-facilities";
import { otherEstablishments } from "@/lib/other-establishments";

export const MALAYSIA_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Kuala Lumpur",
  "Labuan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "Putrajaya",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
] as const;

export type MalaysiaState = (typeof MALAYSIA_STATES)[number];

const aliases: Record<string, MalaysiaState> = {
  johor: "Johor",
  kedah: "Kedah",
  kelantan: "Kelantan",
  "kuala lumpur": "Kuala Lumpur",
  "wilayah persekutuan kuala lumpur": "Kuala Lumpur",
  "federal territory of kuala lumpur": "Kuala Lumpur",
  labuan: "Labuan",
  "wilayah persekutuan labuan": "Labuan",
  "federal territory of labuan": "Labuan",
  melaka: "Melaka",
  malacca: "Melaka",
  "negeri sembilan": "Negeri Sembilan",
  pahang: "Pahang",
  penang: "Penang",
  "pulau pinang": "Penang",
  perak: "Perak",
  perlis: "Perlis",
  putrajaya: "Putrajaya",
  "wilayah persekutuan putrajaya": "Putrajaya",
  "federal territory of putrajaya": "Putrajaya",
  sabah: "Sabah",
  sarawak: "Sarawak",
  selangor: "Selangor",
  terengganu: "Terengganu",
};

const facilityStateBySlug = new Map<string, MalaysiaState>([
  ...malaysiaFacilities.map((facility) => [facility.slug, facility.state as MalaysiaState] as const),
  ...otherEstablishments.map((facility) => [facility.slug, facility.state as MalaysiaState] as const),
]);

const kualaLumpurSlugs = new Set([
  "merdeka-general-hospital",
  "bangsar-community-hospital",
  "bukit-bintang-family-clinic",
  "setapak-primary-care-clinic",
]);

export function normalizeMalaysiaState(value: string | null | undefined): MalaysiaState | null {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .replace(/darul\s+(takzim|aman|naim|makmur|ridzuan|ihsan|iman)/g, "")
    .replace(/pulau pinang/g, "penang")
    .replace(/wilayah persekutuan/g, "")
    .replace(/federal territory of/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return aliases[normalized] ?? null;
}

export function getEstablishmentState(location: { slug: string; address: string; state?: string | null }): MalaysiaState | null {
  if (location.state) {
    const fromColumn = normalizeMalaysiaState(location.state);
    if (fromColumn) return fromColumn;
  }
  const catalogState = facilityStateBySlug.get(location.slug);
  if (catalogState) return catalogState;
  if (kualaLumpurSlugs.has(location.slug)) return "Kuala Lumpur";

  const address = location.address.toLowerCase();
  const candidates: Array<[string, MalaysiaState]> = [
    ["negeri sembilan", "Negeri Sembilan"],
    ["kuala lumpur", "Kuala Lumpur"],
    ["pulau pinang", "Penang"],
    ["penang", "Penang"],
    ["johor", "Johor"],
    ["kedah", "Kedah"],
    ["kelantan", "Kelantan"],
    ["melaka", "Melaka"],
    ["malacca", "Melaka"],
    ["pahang", "Pahang"],
    ["perak", "Perak"],
    ["perlis", "Perlis"],
    ["sabah", "Sabah"],
    ["sarawak", "Sarawak"],
    ["selangor", "Selangor"],
    ["terengganu", "Terengganu"],
  ];
  return candidates.find(([label]) => address.includes(label))?.[1] ?? null;
}

// Approximate capital/major-city centroids, used as a last-resort fallback when an
// address can’t be geocoded so onboarding never hard-fails on coordinates.
export const STATE_CENTROIDS: Record<string, [number, number]> = {
  Johor: [1.4655, 103.7578],
  Kedah: [6.1248, 100.3678],
  Kelantan: [6.1256, 102.2381],
  "Kuala Lumpur": [3.139, 101.6869],
  Labuan: [5.2831, 115.2308],
  Melaka: [2.1896, 102.2501],
  "Negeri Sembilan": [2.7297, 101.9381],
  Pahang: [3.8077, 103.326],
  Penang: [5.4141, 100.3288],
  Perak: [4.5975, 101.0901],
  Perlis: [6.4414, 100.1963],
  Putrajaya: [2.9264, 101.6964],
  Sabah: [5.9788, 116.0753],
  Sarawak: [1.5535, 110.3593],
  Selangor: [3.0733, 101.5185],
  Terengganu: [5.3117, 103.1324],
};
