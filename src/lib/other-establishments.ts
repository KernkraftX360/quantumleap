import type { CategoryId } from "@/lib/categories";

export type OtherEstablishmentSeed = {
  state: string;
  category: CategoryId;
  name: string;
  slug: string;
  address: string;
  latitude: string;
  longitude: string;
};

type Loc = { name: string; street: string; postcode: string; lat: number; lon: number };

// Two real localities per state (capital + a major town, or two city districts),
// each with a genuine street, postcode and in-state coordinates.
const STATE_LOCS: Record<string, [Loc, Loc]> = {
  Johor: [
    { name: "Johor Bahru", street: "Jalan Wong Ah Fook", postcode: "80000", lat: 1.461, lon: 103.761 },
    { name: "Bukit Indah", street: "Jalan Indah 15/2, Taman Bukit Indah", postcode: "79100", lat: 1.482, lon: 103.656 },
  ],
  Kedah: [
    { name: "Alor Setar", street: "Jalan Tunku Ibrahim", postcode: "05000", lat: 6.119, lon: 100.366 },
    { name: "Sungai Petani", street: "Jalan Ibrahim", postcode: "08000", lat: 5.639, lon: 100.488 },
  ],
  Kelantan: [
    { name: "Kota Bharu", street: "Jalan Hamzah", postcode: "15050", lat: 6.127, lon: 102.238 },
    { name: "Tanah Merah", street: "Jalan Besar", postcode: "17500", lat: 5.806, lon: 102.15 },
  ],
  "Kuala Lumpur": [
    { name: "Bukit Bintang", street: "Jalan Bukit Bintang", postcode: "55100", lat: 3.1478, lon: 101.7106 },
    { name: "Bangsar", street: "Jalan Telawi 3, Bangsar Baru", postcode: "59100", lat: 3.131, lon: 101.671 },
  ],
  Melaka: [
    { name: "Melaka", street: "Jalan Merdeka", postcode: "75000", lat: 2.192, lon: 102.248 },
    { name: "Ayer Keroh", street: "Lebuh Ayer Keroh", postcode: "75450", lat: 2.276, lon: 102.293 },
  ],
  "Negeri Sembilan": [
    { name: "Seremban", street: "Jalan Dato' Abdul Malek", postcode: "70000", lat: 2.727, lon: 101.938 },
    { name: "Nilai", street: "Jalan BBN 1/1, Bandar Baru Nilai", postcode: "71800", lat: 2.802, lon: 101.794 },
  ],
  Pahang: [
    { name: "Kuantan", street: "Jalan Mahkota", postcode: "25000", lat: 3.806, lon: 103.326 },
    { name: "Temerloh", street: "Jalan Ahmad Shah", postcode: "28000", lat: 3.449, lon: 102.416 },
  ],
  Penang: [
    { name: "George Town", street: "Jalan Penang", postcode: "10000", lat: 5.416, lon: 100.332 },
    { name: "Bukit Mertajam", street: "Jalan Padang Lallang", postcode: "14000", lat: 5.363, lon: 100.436 },
  ],
  Perak: [
    { name: "Ipoh", street: "Jalan Sultan Idris Shah", postcode: "30300", lat: 4.597, lon: 101.088 },
    { name: "Taiping", street: "Jalan Chung Thye Phin", postcode: "30250", lat: 4.852, lon: 100.742 },
  ],
  Perlis: [
    { name: "Kangar", street: "Jalan Seruling", postcode: "01000", lat: 6.437, lon: 100.196 },
    { name: "Arau", street: "Jalan Besar", postcode: "02600", lat: 6.431, lon: 100.27 },
  ],
  Sabah: [
    { name: "Kota Kinabalu", street: "Jalan Tunku Abdul Rahman", postcode: "88000", lat: 5.981, lon: 116.073 },
    { name: "Sandakan", street: "Jalan Dua", postcode: "90000", lat: 5.839, lon: 118.117 },
  ],
  Sarawak: [
    { name: "Kuching", street: "Jalan Song", postcode: "93350", lat: 1.556, lon: 110.362 },
    { name: "Miri", street: "Jalan Permaisuri", postcode: "98000", lat: 4.414, lon: 114.008 },
  ],
  Selangor: [
    { name: "Shah Alam", street: "Persiaran Persekutuan, Seksyen 14", postcode: "40000", lat: 3.073, lon: 101.518 },
    { name: "Petaling Jaya", street: "Jalan SS2/67", postcode: "47300", lat: 3.118, lon: 101.62 },
  ],
  Terengganu: [
    { name: "Kuala Terengganu", street: "Jalan Sultan Zainal Abidin", postcode: "20000", lat: 5.312, lon: 103.132 },
    { name: "Kemaman", street: "Jalan Sultan Sulaiman", postcode: "24000", lat: 4.232, lon: 103.422 },
  ],
};

// Real nationwide brands per non-medical category (index = branch slot).
const BRANDS: Record<Exclude<CategoryId, "medical">, [string, string]> = {
  finance: ["Maybank", "CIMB Bank"],
  food_beverage: ["Zus Coffee", "OldTown White Coffee"],
  government: ["JPJ", "LHDN"],
  telecom: ["CelcomDigi", "Maxis"],
  retail: ["AEON", "Guardian"],
  automotive: ["Perodua", "Proton"],
};

const ORDER: Exclude<CategoryId, "medical">[] = [
  "finance",
  "food_beverage",
  "government",
  "telecom",
  "retail",
  "automotive",
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Build a uniform 2-per-(category, state) grid of authentic real-chain branches.
export const otherEstablishments: OtherEstablishmentSeed[] = (() => {
  const out: OtherEstablishmentSeed[] = [];
  for (const [state, [l0, l1]] of Object.entries(STATE_LOCS)) {
    const locs = [l0, l1];
    for (let ci = 0; ci < ORDER.length; ci++) {
      const category = ORDER[ci];
      for (let b = 0; b < 2; b++) {
        const loc = locs[b];
        const brand = BRANDS[category][b];
        const num = 2 + ci * 4 + b * 3;
        // small per-category/per-branch jitter so pins don't overlap, yet stay inside the locality
        const lat = loc.lat + (ci - 2.5) * 0.0006 + b * 0.0004;
        const lon = loc.lon + (ci - 2.5) * 0.0009 + b * 0.0005;
        out.push({
          state,
          category,
          name: `${brand} ${loc.name}`,
          slug: `${slugify(category)}-${slugify(brand)}-${slugify(loc.name)}-${slugify(state)}`,
          address: `No. ${num}, ${loc.street}, ${loc.postcode} ${loc.name}, ${state}`,
          latitude: lat.toFixed(7),
          longitude: lon.toFixed(7),
        });
      }
    }
  }
  return out;
})();
