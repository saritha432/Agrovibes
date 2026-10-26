import type { ImageSourcePropType } from "react-native";

export type RentalCatalogItem = {
  id: string;
  categoryId: string;
  subCategoryId: string;
  title: string;
  subtitle: string;
  detail: string;
  rating: number;
  reviewLabel: string;
  eta: string;
  tag?: string;
  options: string[];
  discountPct: number;
  price: number;
  mrp: number;
  unitLabel: string;
  image: ImageSourcePropType;
};

export type RentalCatalogSub = {
  id: string;
  label: string;
  image: ImageSourcePropType;
};

const tractor = require("../../../assets/market/tractor-rental.png");
const equipment = require("../../../assets/market/new-equiptment.png");
const usedGear = require("../../../assets/market/used-refurbished.png");
const drone = require("../../../assets/market/drone-spraying.png");
const sprayReport = require("../../../assets/market/post_spray_report.png");
const operator = require("../../../assets/market/make_your_operator.png");
const timeslot = require("../../../assets/market/pick_a_timeslot .png");
const service = require("../../../assets/market/Book _a_ service.png");
const callService = require("../../../assets/market/Call_a_servicenB.png");
const soilKit = require("../../../assets/market/soiltest-kit.png");
const fieldMap = require("../../../assets/market/field_mappimg.png");
const crop = require("../../../assets/market/crop.png");
const greenhouse = require("../../../assets/market/greenhouse.png");

export const RENTAL_CATALOG_SUBS: Record<string, RentalCatalogSub[]> = {
  machinery: [
    { id: "tractors", label: "Tractors", image: tractor },
    { id: "tools", label: "Tools", image: equipment },
    { id: "used", label: "Used", image: usedGear }
  ],
  drone: [
    { id: "spray", label: "Spray", image: drone },
    { id: "report", label: "Report", image: sprayReport }
  ],
  drivers: [
    { id: "operators", label: "Operators", image: operator },
    { id: "slots", label: "Time slots", image: timeslot }
  ],
  labour: [
    { id: "crew", label: "Crew", image: service },
    { id: "call", label: "On call", image: callService }
  ],
  soil: [
    { id: "kit", label: "Test kit", image: soilKit },
    { id: "field", label: "Field map", image: fieldMap }
  ],
  transplanting: [
    { id: "paddy", label: "Paddy", image: crop },
    { id: "nursery", label: "Nursery", image: greenhouse }
  ]
};

export const RENTAL_CATALOG: RentalCatalogItem[] = [
  {
    id: "swaraj-744",
    categoryId: "machinery",
    subCategoryId: "tractors",
    title: "Swaraj 744",
    subtitle: "48 HP | With driver on request",
    detail: "A field tractor for ploughing, rotavation, and haulage. Book by the day or by the hour.",
    rating: 4.7,
    reviewLabel: "24.6k",
    eta: "10 MIN",
    tag: "Ready today",
    options: ["Per day", "Per hour", "With operator"],
    discountPct: 8,
    price: 2323,
    mrp: 2525,
    unitLabel: "Day",
    image: tractor
  },
  {
    id: "mahindra-575",
    categoryId: "machinery",
    subCategoryId: "tractors",
    title: "Mahindra 575",
    subtitle: "45 HP | 2WD",
    detail: "Compact tractor for smaller plots and inter-cultivation.",
    rating: 4.6,
    reviewLabel: "18.2k",
    eta: "12 MIN",
    tag: "Popular",
    options: ["Per day", "Per hour"],
    discountPct: 6,
    price: 2100,
    mrp: 2230,
    unitLabel: "Day",
    image: tractor
  },
  {
    id: "rotavator",
    categoryId: "machinery",
    subCategoryId: "tools",
    title: "Rotavator",
    subtitle: "5 ft | Fits 35 HP and above",
    detail: "Gear-drive rotavator for seed-bed preparation.",
    rating: 4.5,
    reviewLabel: "9.4k",
    eta: "15 MIN",
    options: ["Per day", "Per acre"],
    discountPct: 10,
    price: 900,
    mrp: 1000,
    unitLabel: "Day",
    image: equipment
  },
  {
    id: "power-tiller",
    categoryId: "machinery",
    subCategoryId: "tools",
    title: "Power tiller",
    subtitle: "13 HP | Diesel",
    detail: "Walk-behind tiller for vegetable beds and orchard rows.",
    rating: 4.4,
    reviewLabel: "6.8k",
    eta: "14 MIN",
    options: ["Per day", "Per hour"],
    discountPct: 7,
    price: 1400,
    mrp: 1505,
    unitLabel: "Day",
    image: equipment
  },
  {
    id: "used-tractor",
    categoryId: "machinery",
    subCategoryId: "used",
    title: "Used tractor",
    subtitle: "Checked | Short hire",
    detail: "Refurbished tractor for a short job when a new machine is not needed.",
    rating: 4.3,
    reviewLabel: "5.1k",
    eta: "20 MIN",
    options: ["Per day", "Half day"],
    discountPct: 12,
    price: 1600,
    mrp: 1820,
    unitLabel: "Day",
    image: usedGear
  },
  {
    id: "drone-acre",
    categoryId: "drone",
    subCategoryId: "spray",
    title: "Crop spray drone",
    subtitle: "10 L tank | Per acre",
    detail: "Drone spraying for pesticides and nutrients, booked by the acre.",
    rating: 4.8,
    reviewLabel: "11.2k",
    eta: "30 MIN",
    tag: "Licensed pilot",
    options: ["Per acre", "Half day", "Full day"],
    discountPct: 8,
    price: 450,
    mrp: 490,
    unitLabel: "Acre",
    image: drone
  },
  {
    id: "drone-report",
    categoryId: "drone",
    subCategoryId: "report",
    title: "Spray report",
    subtitle: "Map and coverage notes",
    detail: "A written spray report with the area covered and the mix used.",
    rating: 4.5,
    reviewLabel: "3.2k",
    eta: "1 DAY",
    options: ["One field", "Full farm"],
    discountPct: 5,
    price: 300,
    mrp: 315,
    unitLabel: "Report",
    image: sprayReport
  },
  {
    id: "tractor-driver",
    categoryId: "drivers",
    subCategoryId: "operators",
    title: "Tractor operator",
    subtitle: "Licensed | Day shift",
    detail: "An operator who brings the machine or drives yours for the day.",
    rating: 4.6,
    reviewLabel: "8.1k",
    eta: "20 MIN",
    options: ["Day shift", "Half day", "Night shift"],
    discountPct: 0,
    price: 800,
    mrp: 800,
    unitLabel: "Day",
    image: operator
  },
  {
    id: "harvester-driver",
    categoryId: "drivers",
    subCategoryId: "operators",
    title: "Harvester operator",
    subtitle: "Season crew",
    detail: "Operator for a combine or reaper during harvest.",
    rating: 4.7,
    reviewLabel: "4.4k",
    eta: "1 DAY",
    options: ["Per day", "Per acre"],
    discountPct: 5,
    price: 1200,
    mrp: 1260,
    unitLabel: "Day",
    image: timeslot
  },
  {
    id: "field-crew",
    categoryId: "labour",
    subCategoryId: "crew",
    title: "Field crew",
    subtitle: "8 people | Sowing or weeding",
    detail: "A manual crew for sowing, weeding, or harvest.",
    rating: 4.4,
    reviewLabel: "7.6k",
    eta: "1 DAY",
    options: ["4 people", "8 people", "12 people"],
    discountPct: 6,
    price: 2800,
    mrp: 2980,
    unitLabel: "Day",
    image: service
  },
  {
    id: "on-call-labour",
    categoryId: "labour",
    subCategoryId: "call",
    title: "On-call labour",
    subtitle: "Same-day help",
    detail: "A smaller crew you can call when a job runs long.",
    rating: 4.2,
    reviewLabel: "2.9k",
    eta: "2 HR",
    options: ["2 people", "4 people"],
    discountPct: 0,
    price: 1400,
    mrp: 1400,
    unitLabel: "Day",
    image: callService
  },
  {
    id: "soil-kit",
    categoryId: "soil",
    subCategoryId: "kit",
    title: "Soil test kit",
    subtitle: "NPK and pH | Lab report",
    detail: "Sample pickup and a nutrient report for the next crop.",
    rating: 4.6,
    reviewLabel: "6.2k",
    eta: "2 DAY",
    tag: "Lab report",
    options: ["1 sample", "3 samples", "Full field"],
    discountPct: 10,
    price: 499,
    mrp: 555,
    unitLabel: "Sample",
    image: soilKit
  },
  {
    id: "field-map",
    categoryId: "soil",
    subCategoryId: "field",
    title: "Field nutrient map",
    subtitle: "Zone-wise reading",
    detail: "A simple map of where the field needs more nutrient.",
    rating: 4.5,
    reviewLabel: "1.8k",
    eta: "3 DAY",
    options: ["One field", "Whole farm"],
    discountPct: 8,
    price: 1500,
    mrp: 1630,
    unitLabel: "Map",
    image: fieldMap
  },
  {
    id: "paddy-transplant",
    categoryId: "transplanting",
    subCategoryId: "paddy",
    title: "Paddy transplanting",
    subtitle: "Machine or crew | Per acre",
    detail: "Transplanting for a puddled paddy field, booked by the acre.",
    rating: 4.6,
    reviewLabel: "9.9k",
    eta: "1 DAY",
    options: ["Per acre", "Half day", "Full day"],
    discountPct: 7,
    price: 1800,
    mrp: 1935,
    unitLabel: "Acre",
    image: crop
  },
  {
    id: "nursery-seedlings",
    categoryId: "transplanting",
    subCategoryId: "nursery",
    title: "Seedling transplant",
    subtitle: "Tomato, chilli, brinjal",
    detail: "A crew to move nursery seedlings into the main field.",
    rating: 4.4,
    reviewLabel: "3.7k",
    eta: "1 DAY",
    options: ["Half acre", "One acre"],
    discountPct: 5,
    price: 1200,
    mrp: 1260,
    unitLabel: "Acre",
    image: greenhouse
  }
];

export function catalogForCategory(categoryId: string): RentalCatalogItem[] {
  return RENTAL_CATALOG.filter((item) => item.categoryId === categoryId);
}
