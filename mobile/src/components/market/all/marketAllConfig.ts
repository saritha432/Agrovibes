import type { Ionicons } from "@expo/vector-icons";
import type { SvgModule } from "../shared/marketAssetUtils";

export type ProductRailItem = {
  id: string;
  title: string;
  eta: string;
  price: number;
  mrp: number;
  discountPct: number;
};

export type CategoryGridItem = {
  id: string;
  label: string;
  icon?: SvgModule;
  artKind?: "svg" | "png";
  artWidth?: number;
  artHeight?: number;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
};

export type MarketServiceSection = {
  title: string;
  columns: 2 | 3 | 4;
  items: CategoryGridItem[];
  tileWidth?: number;
  tileHeight?: number;
};

export type MarketServiceCard = {
  id: string;
  variant: "dark" | "gradient";
  backgroundColor?: string;
  sections: MarketServiceSection[];
};

export const MARKET_CATEGORY_TILE_SIZE = 85;

function marketSection(
  title: string,
  columns: 2 | 3 | 4,
  items: CategoryGridItem[]
): MarketServiceSection {
  return {
    title,
    columns,
    items,
    tileWidth: MARKET_CATEGORY_TILE_SIZE,
    tileHeight: MARKET_CATEGORY_TILE_SIZE
  };
}

export const MONSOON_PRODUCTS: ProductRailItem[] = [
  {
    id: "cooler-1",
    title: "Register the company by Kisan City",
    eta: "11 mins | 12 km",
    price: 1200,
    mrp: 1714,
    discountPct: 30
  },
  {
    id: "cooler-2",
    title: "Monsoon Cooler Pro 45L",
    eta: "14 mins | 8 km",
    price: 2499,
    mrp: 3299,
    discountPct: 24
  },
  {
    id: "cooler-3",
    title: "Farm Mist Cooling Unit",
    eta: "18 mins | 15 km",
    price: 1899,
    mrp: 2599,
    discountPct: 27
  }
];

const BETTER_HARVEST_ITEMS: CategoryGridItem[] = [
  {
    id: "seeds",
    label: "Seeds & Saplings",
    icon: require("../../../../assets/market/seeds-saplings.svg"),
    fallbackIcon: "leaf-outline"
  },
  {
    id: "fertilizers",
    label: "Fertilizers & Nutrients",
    icon: require("../../../../assets/market/fertilizers-nutrients.svg"),
    fallbackIcon: "flask-outline"
  },
  {
    id: "crop-protection",
    label: "Crop Protection",
    icon: require("../../../../assets/market/crop.svg"),
    fallbackIcon: "shield-checkmark-outline"
  },
  {
    id: "soil-test",
    label: "Soil Test Kits",
    icon: require("../../../../assets/market/soiltest-kit.svg"),
    fallbackIcon: "beaker-outline"
  }
];

const BUILT_FOR_FARMERS_ITEMS: CategoryGridItem[] = [
  {
    id: "tools",
    label: "Tools & Equipment",
    icon: require("../../../../assets/market/essentials.svg"),
    fallbackIcon: "construct-outline"
  },
  {
    id: "irrigation",
    label: "Irrigation Systems",
    icon: require("../../../../assets/market/irrigation-system.svg"),
    fallbackIcon: "water-outline"
  },
  {
    id: "greenhouse",
    label: "Greenhouse & Covers",
    icon: require("../../../../assets/market/greenhouse.svg"),
    fallbackIcon: "home-outline"
  },
  {
    id: "livestock",
    label: "Livestock Supplies",
    icon: require("../../../../assets/market/livestock.svg"),
    fallbackIcon: "paw-outline"
  }
];

const SELL_HARVEST_ITEMS: CategoryGridItem[] = [
  {
    id: "fresh-produce",
    label: "Fresh Produce",
    icon: require("../../../../assets/market/freshproduce.svg"),
    fallbackIcon: "nutrition-outline"
  },
  {
    id: "bulk-orders",
    label: "Bulk Orders",
    icon: require("../../../../assets/market/bulk-orders.svg"),
    artWidth: 42,
    artHeight: 50,
    fallbackIcon: "cube-outline"
  }
];

const MACHINE_ON_HIRE_ITEMS: CategoryGridItem[] = [
  {
    id: "browse-book",
    label: "Browse & Book",
    icon: require("../../../../assets/market/tractor-rental.png"),
    artKind: "png",
    fallbackIcon: "search-outline"
  },
  {
    id: "my-bookings",
    label: "My Bookings",
    icon: require("../../../../assets/market/mybookings.svg"),
    fallbackIcon: "calendar-outline"
  }
];

const BROWSE_COMPARE_ITEMS: CategoryGridItem[] = [
  {
    id: "new-equipment",
    label: "New Equipment",
    icon: require("../../../../assets/market/buy.svg"),
    fallbackIcon: "cart-outline"
  },
  { id: "used-refurb", label: "Used & Refurbished", fallbackIcon: "refresh-outline" },
  { id: "compare", label: "Compare Models", fallbackIcon: "git-compare-outline" }
];

const PLAN_PURCHASE_ITEMS: CategoryGridItem[] = [
  { id: "emi", label: "EMI Calculator", fallbackIcon: "calculator-outline" },
  { id: "subsidies", label: "Check Subsidies", fallbackIcon: "ribbon-outline" },
  { id: "loan", label: "Apply For A Loan", fallbackIcon: "card-outline" }
];

const TALK_DEALER_ITEMS: CategoryGridItem[] = [
  { id: "demo", label: "Book A Demo", fallbackIcon: "videocam-outline" },
  { id: "dealer", label: "Find A Dealer", fallbackIcon: "location-outline" }
];

const BOOK_VEHICLE_ITEMS: CategoryGridItem[] = [
  {
    id: "truck-tempo",
    label: "Truck & Tempo",
    icon: require("../../../../assets/market/transport.svg"),
    fallbackIcon: "bus-outline"
  },
  { id: "cold-chain", label: "Cold Chain Transport", fallbackIcon: "snow-outline" },
  { id: "mandi-drop", label: "Mandi Drop Off", fallbackIcon: "pin-outline" }
];

const HAULTRACK_ITEMS: CategoryGridItem[] = [
  { id: "estimate-route", label: "Estimate Route & Cost", fallbackIcon: "map-outline" },
  { id: "compare-quotes", label: "Compare Quotes", fallbackIcon: "stats-chart-outline" },
  { id: "track-shipment", label: "Track Your Shipment", fallbackIcon: "navigate-outline" }
];

const REPAIR_MAINTAIN_ITEMS: CategoryGridItem[] = [
  { id: "book-service", label: "Book A Service", fallbackIcon: "build-outline" },
  { id: "call-tech", label: "Call A Technician", fallbackIcon: "call-outline" },
  { id: "spare-parts", label: "Order Spare Parts", fallbackIcon: "cog-outline" },
  { id: "service-records", label: "Service Records", fallbackIcon: "document-text-outline" },
  { id: "track-warranty", label: "Track Warranty", fallbackIcon: "shield-outline" }
];

const DRONE_ON_DEMAND_ITEMS: CategoryGridItem[] = [
  { id: "crop-spray", label: "Book Crop Spraying", fallbackIcon: "airplane-outline" },
  { id: "field-mapping", label: "Field Mapping", fallbackIcon: "map-outline" },
  { id: "meet-operator", label: "Meet Your Operator", fallbackIcon: "person-outline" },
  { id: "pick-slot", label: "Pick A Time Slot", fallbackIcon: "time-outline" },
  { id: "spray-report", label: "Post Spray Report", fallbackIcon: "document-outline" }
];

/** Grouped service cards — edit order/sections here to match CMS or Figma. */
export const MARKET_SERVICE_CARDS: MarketServiceCard[] = [
  {
    id: "farm-core",
    variant: "dark",
    sections: [
      marketSection("Better Harvest", 4, BETTER_HARVEST_ITEMS),
      marketSection("Built For Farmers", 4, BUILT_FOR_FARMERS_ITEMS),
      marketSection("Sell Your Harvest", 2, SELL_HARVEST_ITEMS)
    ]
  },
  {
    id: "machine-hire",
    variant: "gradient",
    backgroundColor: "#ECECEC",
    sections: [marketSection("Machine On Hire", 2, MACHINE_ON_HIRE_ITEMS)]
  },
  {
    id: "browse-plan",
    variant: "dark",
    sections: [
      marketSection("Browse & Compare", 3, BROWSE_COMPARE_ITEMS),
      marketSection("Plan Your Purchase", 3, PLAN_PURCHASE_ITEMS),
      marketSection("Talk To A Dealer", 2, TALK_DEALER_ITEMS)
    ]
  },
  {
    id: "transport",
    variant: "gradient",
    sections: [
      marketSection("Book A Vehicle", 3, BOOK_VEHICLE_ITEMS),
      marketSection("HaulTrack", 3, HAULTRACK_ITEMS)
    ]
  },
  {
    id: "services",
    variant: "dark",
    sections: [
      marketSection("Repair & Maintain", 4, REPAIR_MAINTAIN_ITEMS),
      marketSection("Drone On Demand", 4, DRONE_ON_DEMAND_ITEMS)
    ]
  }
];
