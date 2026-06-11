import type { Ionicons } from "@expo/vector-icons";
import type { SvgModule } from "../shared/marketAssetUtils";

export type ProductRailItem = {
  id: string;
  title: string;
  eta?: string;
  rating?: number;
  reviewCount?: string | number;
  deliveryMinutes?: string;
  tag?: string;
  sizes?: string[];
  price: number;
  mrp: number;
  discountPct: number;
  unitPrice?: string;
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
  items: CategoryGridItem[],
  tileSize = MARKET_CATEGORY_TILE_SIZE
): MarketServiceSection {
  return {
    title,
    columns,
    items: items.map((item) =>
      item.icon && item.artKind == null ? { ...item, artKind: "png" as const } : item
    ),
    tileWidth: tileSize,
    tileHeight: tileSize
  };
}

export const MONSOON_PRODUCTS: ProductRailItem[] = [
  {
    id: "cooler-1",
    title: "Register the company",
    rating: 3.2,
    reviewCount: "24.6k",
    deliveryMinutes: "10 MIN",
    tag: "7g Protein/100g",
    sizes: ["500 ml", "2ltr", "4 X 500ml"],
    price: 1200,
    mrp: 1200,
    discountPct: 50,
    unitPrice: "₹45.2 /kg"
  },
  {
    id: "cooler-2",
    title: "Register the company",
    rating: 3.2,
    reviewCount: "24.6k",
    deliveryMinutes: "10 MIN",
    tag: "7g Protein/100g",
    sizes: ["500 ml", "2ltr", "4 X 500ml"],
    price: 1200,
    mrp: 1200,
    discountPct: 50,
    unitPrice: "₹45.2 /kg"
  },
  {
    id: "cooler-3",
    title: "Register the company",
    rating: 3.2,
    reviewCount: "24.6k",
    deliveryMinutes: "10 MIN",
    tag: "7g Protein/100g",
    sizes: ["500 ml", "2ltr", "4 X 500ml"],
    price: 1200,
    mrp: 1200,
    discountPct: 50,
    unitPrice: "₹45.2 /kg"
  },
  {
    id: "cooler-4",
    title: "Register the company",
    rating: 3.2,
    reviewCount: "24.6k",
    deliveryMinutes: "10 MIN",
    tag: "7g Protein/100g",
    sizes: ["500 ml", "2ltr", "4 X 500ml"],
    price: 1200,
    mrp: 1200,
    discountPct: 50,
    unitPrice: "₹45.2 /kg"
  }
];

const BETTER_HARVEST_ITEMS: CategoryGridItem[] = [
  {
    id: "seeds",
    label: "Seeds & Saplings",
    icon: require("../../../../assets/market/seeds-saplings.png"),
    fallbackIcon: "leaf-outline"
  },
  {
    id: "fertilizers",
    label: "Fertilizers & Nutrients",
    icon: require("../../../../assets/market/fertilizers-nutrients.png"),
    fallbackIcon: "flask-outline"
  },
  {
    id: "crop-protection",
    label: "Crop Protection",
    icon: require("../../../../assets/market/crop.png"),
    fallbackIcon: "shield-checkmark-outline"
  },
  {
    id: "soil-test",
    label: "Soil Test Kits",
    icon: require("../../../../assets/market/soiltest-kit.png"),
    fallbackIcon: "beaker-outline"
  }
];

const BUILT_FOR_FARMERS_ITEMS: CategoryGridItem[] = [
  {
    id: "tools",
    label: "Tools & Equipment",
    icon: require("../../../../assets/market/essentials.png"),
    fallbackIcon: "construct-outline"
  },
  {
    id: "irrigation",
    label: "Irrigation Systems",
    icon: require("../../../../assets/market/irrigation-system.png"),
    fallbackIcon: "water-outline"
  },
  {
    id: "greenhouse",
    label: "Greenhouse & Covers",
    icon: require("../../../../assets/market/greenhouse.png"),
    fallbackIcon: "home-outline"
  },
  {
    id: "livestock",
    label: "Livestock Supplies",
    icon: require("../../../../assets/market/livestock.png"),
    fallbackIcon: "paw-outline"
  }
];

const SELL_HARVEST_ITEMS: CategoryGridItem[] = [
  {
    id: "fresh-produce",
    label: "Fresh Produce",
    icon: require("../../../../assets/market/freshproduce.png"),
    fallbackIcon: "nutrition-outline"
  },
  {
    id: "bulk-orders",
    label: "Bulk Orders",
    icon: require("../../../../assets/market/bulk-orders.png"),
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
    icon: require("../../../../assets/market/mybookings.png"),
    fallbackIcon: "calendar-outline"
  }
];

const BROWSE_COMPARE_ITEMS: CategoryGridItem[] = [
  {
    id: "new-equipment",
    label: "New Equipment",
    icon: require("../../../../assets/market/new-equiptment.png"),
    artWidth: 50,
    artHeight: 40
  },
  { id: "used-refurb", label: "Used & Refurbished",
    icon: require("../../../../assets/market/used-refurbished.png"), 
    artWidth: 65,
    artHeight: 40
  },
  { id: "compare", label: "Compare Models", 
    icon: require("../../../../assets/market/bulk-orders.png"),}
];

const PLAN_PURCHASE_ITEMS: CategoryGridItem[] = [
  { id: "emi", label: "EMI Calculator", artWidth: 46,
    artHeight: 50,
    icon: require("../../../../assets/market/emi-calculator.png"),
   },
  { id: "subsidies", label: "Check Subsidies", artWidth: 87,
    artHeight: 45,
    icon: require("../../../../assets/market/check-subsidies.png"),
   },
  { id: "loan", label: "Apply For A Loan", artWidth: 90,
    artHeight: 50,
    icon: require("../../../../assets/market/apply-for-loan.png"),
   }
];

const TALK_DEALER_ITEMS: CategoryGridItem[] = [
  { id: "demo", label: "Book A Demo",
    artWidth: 43,
    artHeight: 47,
    icon: require("../../../../assets/market/book-demo.png"), },
  { id: "dealer", label: "Find A Dealer",
    icon: require("../../../../assets/market/find-a-dealer.png"),
    artWidth: 45,
    artHeight: 60
   }
];

const BOOK_VEHICLE_ITEMS: CategoryGridItem[] = [
  {
    id: "truck-tempo",
    label: "Truck & Tempo",
    icon: require("../../../../assets/market/truck_tempo.png"),
  },
  { id: "cold-chain", label: "Cold Chain Transport",
    icon: require("../../../../assets/market/coldchain_Transport.png"),  },
  { id: "mandi-drop", label: "Mandi Drop Off", }
];

const HAULTRACK_ITEMS: CategoryGridItem[] = [
  { id: "estimate-route", label: "Estimate Route & Cost",
    icon: require("../../../../assets/market/estimate_route-cost.png"),
    },
  { id: "compare-quotes", label: "Compare Quotes",  },
  { id: "track-shipment", label: "Track Your Shipment", 
    icon: require("../../../../assets/market/track_your_shipment.png"),
   }
];

const REPAIR_MAINTAIN_ITEMS: CategoryGridItem[] = [
  {
    id: "book-service",
    label: "Book A Service",
    icon: require("../../../../assets/market/Book _a_ service.png"),
    artWidth: 42,
    artHeight: 50
  },
  {
    id: "call-tech",
    label: "Call A Technician",
    icon: require("../../../../assets/market/Call_a_servicenB.png"),
    artWidth: 42,
    artHeight: 50
  },
  { id: "spare-parts", label: "Order Spare Parts", 
    icon: require("../../../../assets/market/oder_spare_ parts.png"),
    artWidth: 55,
    artHeight: 45
   },
  { id: "service-records", label: "Service Records",
    icon: require("../../../../assets/market/service_history.png"),
    artWidth: 40,
    artHeight: 46
   },
  { id: "track-warranty", label: "Track Warranty",
    icon: require("../../../../assets/market/track_warrenty.png"),
    artWidth: 37,
    artHeight: 44
   }
];

const DRONE_ON_DEMAND_ITEMS: CategoryGridItem[] = [
  {
    id: "crop-spray",
    label: "Book Crop Spraying",
    icon: require("../../../../assets/market/drone-spraying.png"),
    artKind: "png"
  },
  { id: "field-mapping", label: "Field Mapping", 
    icon: require("../../../../assets/market/field_mappimg.png"),
   },
  { id: "meet-operator", label: "Meet Your Operator", 
    icon: require("../../../../assets/market/make_your_operator.png"),
    artWidth: 30,
    artHeight: 50
  },
  { id: "pick-slot", label: "Pick A Time Slot", 
    icon: require("../../../../assets/market/pick_a_timeslot .png"),
    artWidth: 50,
    artHeight: 50
   },
  { id: "spray-report", label: "Post Spray Report", 
    icon: require("../../../../assets/market/post_spray_report.png"),
    artWidth: 38,
    artHeight: 50 }
];

/** Grouped service cards — edit order/sections here to match CMS or Figma. */
export const MARKET_SERVICE_CARDS: MarketServiceCard[] = [
  {
    id: "farm-core",
    variant: "dark",
    sections: [
      marketSection("Better Harvest", 4, BETTER_HARVEST_ITEMS, 100),
      marketSection("Built For Farmers", 4, BUILT_FOR_FARMERS_ITEMS, 100),
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
    backgroundColor: "#ECECEC",
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

export function getMarketCategoryItem(categoryId: string): CategoryGridItem | undefined {
  for (const card of MARKET_SERVICE_CARDS) {
    for (const section of card.sections) {
      const item = section.items.find((i) => i.id === categoryId);
      if (item) return item;
    }
  }
  return undefined;
}
