import {
  getCurrentSeasonTags,
  isInMonthDayRange,
  matchesSeasonFilter,
  type MarketSeasonTag
} from "./marketSeasonUtils";

export type MarketAdTarget =
  | { type: "browse" }
  | { type: "listings" }
  | { type: "category"; categoryId: string };

export type MarketAd = {
  id: string;
  variant: "light" | "dark";
  badge: string;
  title: string;
  titleAccent?: string;
  subtitle: string;
  highlight?: string;
  cta: string;
  /** Omit for evergreen ads shown in every season. */
  seasons?: MarketSeasonTag[];
  /** Yearly window "MM-DD". Optional extra gate besides seasons. */
  startDate?: string;
  endDate?: string;
  priority?: number;
  target?: MarketAdTarget;
};

export type MarketFeatureCardConfig = {
  id: string;
  accent: string;
  label: string;
  image: number;
  kind: "png";
  seasons?: MarketSeasonTag[];
  priority: number;
  categoryId?: string;
};

const EVERGREEN_ADS: MarketAd[] = [
  {
    id: "farm-home",
    variant: "dark",
    badge: "KISAN BAZAAR",
    title: "Khet Se",
    titleAccent: "Ghar Tak",
    subtitle: "Bhoomi. Bazaar. Barakath.",
    highlight: "10,000+ products • 500+ sellers",
    cta: "Shop Now",
    priority: 100,
    target: { type: "browse" }
  },
  {
    id: "delivery",
    variant: "light",
    badge: "FREE DELIVERY",
    title: "Farm Essentials",
    subtitle: "Order seeds, fertilizers & daily needs with same-day doorstep delivery.",
    highlight: "Delivery in 15–30 mins",
    cta: "Order Now",
    priority: 60,
    target: { type: "category", categoryId: "seeds" }
  },
  {
    id: "tractor-rental",
    variant: "light",
    badge: "MACHINE ON HIRE",
    title: "Tractor & Drone",
    subtitle: "Browse, compare & book farm machinery near you — pay per acre or hour.",
    highlight: "Verified operators nearby",
    cta: "Book Now",
    priority: 50,
    target: { type: "category", categoryId: "browse-book" }
  },
  {
    id: "gov-schemes",
    variant: "dark",
    badge: "GOVT. SCHEMES",
    title: "Subsidies &",
    titleAccent: "Loans",
    subtitle: "Check PM-KISAN, drip subsidy & equipment loans with EMI calculator.",
    highlight: "Apply in 3 easy steps",
    cta: "Check Eligibility",
    priority: 40,
    target: { type: "category", categoryId: "subsidies" }
  },
  {
    id: "sell-harvest",
    variant: "light",
    badge: "SELL YOUR CROP",
    title: "Mandi Prices",
    subtitle: "Get live rates, bulk buyer quotes & cold-chain transport for your harvest.",
    highlight: "Best price guarantee",
    cta: "Sell Now",
    priority: 30,
    target: { type: "category", categoryId: "fresh-produce" }
  }
];

const SEASONAL_ADS: MarketAd[] = [
  {
    id: "monsoon-sale",
    variant: "dark",
    badge: "UP TO 40% OFF",
    title: "Monsoon",
    titleAccent: "Offers",
    subtitle: "Stock up on seeds, crop protection & irrigation before the rains.",
    highlight: "Min. 30% off on coolers & gear",
    cta: "Grab Deals",
    seasons: ["rain", "kharif"],
    startDate: "06-01",
    endDate: "09-30",
    priority: 95,
    target: { type: "category", categoryId: "crop-protection" }
  },
  {
    id: "kharif-prep",
    variant: "dark",
    badge: "KHARIF SEASON",
    title: "Sow",
    titleAccent: "Smarter",
    subtitle: "Hybrid cotton, maize & paddy seeds with germination guarantee.",
    highlight: "Top picks for Kharif 2026",
    cta: "Shop Seeds",
    seasons: ["kharif", "rain"],
    startDate: "05-15",
    endDate: "07-31",
    priority: 92,
    target: { type: "category", categoryId: "seeds" }
  },
  {
    id: "summer-cooling",
    variant: "light",
    badge: "SUMMER ESSENTIALS",
    title: "Beat the",
    titleAccent: "Heat",
    subtitle: "Mulch sheets, shade nets, coolers & drip kits for hot days.",
    highlight: "Same-day delivery available",
    cta: "Shop Summer",
    seasons: ["summer", "zaid"],
    startDate: "03-01",
    endDate: "05-31",
    priority: 88,
    target: { type: "category", categoryId: "irrigation" }
  },
  {
    id: "rabi-wheat",
    variant: "dark",
    badge: "RABI SEASON",
    title: "Wheat &",
    titleAccent: "Pulses",
    subtitle: "Certified Rabi seeds, DAP & urea bundles at mandi-beating prices.",
    highlight: "Free soil test kit on ₹2,000+",
    cta: "Order Now",
    seasons: ["rabi", "winter"],
    startDate: "10-15",
    endDate: "12-31",
    priority: 90,
    target: { type: "category", categoryId: "fertilizers" }
  },
  {
    id: "spring-saplings",
    variant: "light",
    badge: "SPRING PLANTING",
    title: "Fresh",
    titleAccent: "Saplings",
    subtitle: "Tomato, chilli & vegetable trays ready for early field transplant.",
    highlight: "Farm-fresh • 50-tray packs",
    cta: "Browse",
    seasons: ["spring"],
    startDate: "02-01",
    endDate: "04-15",
    priority: 85,
    target: { type: "category", categoryId: "seeds" }
  },
  {
    id: "zaid-veggies",
    variant: "dark",
    badge: "ZAID CROPS",
    title: "Short Season",
    titleAccent: "Veggies",
    subtitle: "Cucumber, watermelon & fodder crops between main harvests.",
    highlight: "Low water • high yield varieties",
    cta: "Explore",
    seasons: ["zaid", "summer"],
    startDate: "04-01",
    endDate: "06-15",
    priority: 82,
    target: { type: "category", categoryId: "seeds" }
  },
  {
    id: "winter-storage",
    variant: "light",
    badge: "WINTER STORAGE",
    title: "Cold Chain",
    titleAccent: "Ready",
    subtitle: "Book insulated transport before harvest peaks hit the mandi.",
    highlight: "Track shipment live",
    cta: "Book Vehicle",
    seasons: ["winter", "rabi"],
    startDate: "11-01",
    endDate: "02-28",
    priority: 78,
    target: { type: "category", categoryId: "truck-tempo" }
  }
];

export const ALL_MARKET_ADS: MarketAd[] = [...EVERGREEN_ADS, ...SEASONAL_ADS];

const ALL_FEATURE_CARDS: MarketFeatureCardConfig[] = [
  {
    id: "kharif",
    accent: "Kharif",
    label: "Season",
    image: require("../../../assets/market/season-items.png"),
    kind: "png",
    seasons: ["kharif", "rain"],
    priority: 100,
    categoryId: "seeds"
  },
  {
    id: "rabi",
    accent: "Rabi",
    label: "Season",
    image: require("../../../assets/market/seeds.png"),
    kind: "png",
    seasons: ["rabi", "winter"],
    priority: 98,
    categoryId: "fertilizers"
  },
  {
    id: "summer",
    accent: "Summer",
    label: "Essentials",
    image: require("../../../assets/market/essentials.png"),
    kind: "png",
    seasons: ["summer", "zaid"],
    priority: 96,
    categoryId: "irrigation"
  },
  {
    id: "spring",
    accent: "Spring",
    label: "Saplings",
    image: require("../../../assets/market/seeds-saplings.png"),
    kind: "png",
    seasons: ["spring"],
    priority: 94,
    categoryId: "seeds"
  },
  {
    id: "tractor",
    accent: "Tractor",
    label: "Rental",
    image: require("../../../assets/market/tractor-rental.png"),
    kind: "png",
    priority: 70,
    categoryId: "browse-book"
  },
  {
    id: "drone",
    accent: "Drone",
    label: "Spraying",
    image: require("../../../assets/market/drone-spraying.png"),
    kind: "png",
    seasons: ["kharif", "rain", "zaid"],
    priority: 75,
    categoryId: "crop-spray"
  },
  {
    id: "gov",
    accent: "Gov.",
    label: "Schemes",
    image: require("../../../assets/market/gov-schemes.png"),
    kind: "png",
    priority: 65,
    categoryId: "subsidies"
  }
];

function isAdInDateWindow(ad: MarketAd, now: Date): boolean {
  if (!ad.startDate || !ad.endDate) return true;
  return isInMonthDayRange(now, ad.startDate, ad.endDate);
}

function sortByPriority<T extends { priority?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function getActiveMarketAds(now = new Date()): MarketAd[] {
  const activeSeasons = getCurrentSeasonTags(now);

  const seasonal = sortByPriority(
    SEASONAL_ADS.filter(
      (ad) => matchesSeasonFilter(ad.seasons, activeSeasons) && isAdInDateWindow(ad, now)
    )
  );

  const evergreen = sortByPriority(EVERGREEN_ADS);

  const merged = sortByPriority([...seasonal, ...evergreen]);

  const seen = new Set<string>();
  const unique = merged.filter((ad) => {
    if (seen.has(ad.id)) return false;
    seen.add(ad.id);
    return true;
  });

  return unique.length > 0 ? unique : evergreen;
}

export function getActiveFeatureCards(now = new Date(), limit = 4): MarketFeatureCardConfig[] {
  const activeSeasons = getCurrentSeasonTags(now);

  const seasonal = sortByPriority(
    ALL_FEATURE_CARDS.filter((card) => matchesSeasonFilter(card.seasons, activeSeasons))
  );

  const evergreen = sortByPriority(ALL_FEATURE_CARDS.filter((card) => !card.seasons?.length));

  const merged = sortByPriority([...seasonal, ...evergreen]);

  const seen = new Set<string>();
  const unique = merged.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });

  return unique.slice(0, limit);
}

export function getPrimarySeasonLabel(now = new Date()): string {
  const tags = getCurrentSeasonTags(now);
  if (tags.includes("kharif")) return "Kharif";
  if (tags.includes("rabi")) return "Rabi";
  if (tags.includes("zaid")) return "Zaid";
  if (tags.includes("rain")) return "Monsoon";
  if (tags.includes("summer")) return "Summer";
  if (tags.includes("winter")) return "Winter";
  if (tags.includes("spring")) return "Spring";
  return "Season";
}
