import type { Ionicons } from "@expo/vector-icons";

export const RENTAL_LOCATIONS = [
  "Telangana",
  "Andhra Pradesh",
  "Karnataka",
  "Maharashtra",
  "Tamil Nadu",
  "Madhya Pradesh"
] as const;

export type RentalLocation = (typeof RENTAL_LOCATIONS)[number];

export type RentalCategory = {
  id: string;
  title: string;
  blurb: string;
  icon: keyof typeof Ionicons.glyphMap;
  wash: string;
};

export const RENTAL_CATEGORIES: RentalCategory[] = [
  {
    id: "drivers",
    title: "Drivers / Operators",
    blurb: "Licensed operators for tractors, harvesters, and other farm machines.",
    icon: "person-outline",
    wash: "#243028"
  },
  {
    id: "drone",
    title: "Drone Services",
    blurb: "Certified pilots for crop spraying and field scouting.",
    icon: "airplane-outline",
    wash: "#1e2c33"
  },
  {
    id: "machinery",
    title: "Machinery & Tools",
    blurb: "Tractors, rotavators, sprayers, and tools rented by the day.",
    icon: "construct-outline",
    wash: "#2a2e1e"
  },
  {
    id: "labour",
    title: "Farm Labour",
    blurb: "Field crews for sowing, weeding, and harvest.",
    icon: "people-outline",
    wash: "#2c261e"
  },
  {
    id: "soil",
    title: "Soil & Crop Care",
    blurb: "Sample pickup and a nutrient report for the next season.",
    icon: "flask-outline",
    wash: "#1e2a28"
  },
  {
    id: "transplanting",
    title: "Transplanting",
    blurb: "Teams and machines for paddy and seedling transplanting.",
    icon: "leaf-outline",
    wash: "#1c2b22"
  }
];

export function rentalCategoryById(id: string): RentalCategory | undefined {
  return RENTAL_CATEGORIES.find((item) => item.id === id);
}

export type BookableRental = {
  id: string;
  title: string;
  category: string;
  channel: string;
  portalCategoryId: string;
};

export function portalCategoryForListing(category: string, title: string): string {
  const text = `${category} ${title}`.toLowerCase();
  if (text.includes("drone")) return "drone";
  if (text.includes("driver") || text.includes("operator")) return "drivers";
  if (/(labour|labor|manual)/.test(text)) return "labour";
  if (text.includes("soil")) return "soil";
  if (text.includes("transplant")) return "transplanting";
  return "machinery";
}
