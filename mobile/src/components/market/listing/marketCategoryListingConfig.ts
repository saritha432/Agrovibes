import type { Ionicons } from "@expo/vector-icons";
import type { ImageSourcePropType } from "react-native";
import { getMarketCategoryItem } from "../all/marketAllConfig";

export type MarketSubCategory = {
  id: string;
  label: string;
  icon?: ImageSourcePropType;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
};

export type MarketListingProduct = {
  id: string;
  subCategoryId: string;
  title: string;
  subtitle: string;
  rating: number;
  reviewLabel: string;
  eta: string;
  germination?: string;
  weights: string[];
  discountPct: number;
  price: number;
  mrp: number;
  unitPrice: number;
};

export type MarketCategoryListingConfig = {
  categoryId: string;
  title: string;
  subCategories: MarketSubCategory[];
  filters: string[];
  products: MarketListingProduct[];
  /** Insert inline ad strips after every N product cards (e.g. 4). */
  inlineAdsEvery?: number;
  /** Show Welcome Kisan Bazaar banner at the bottom of the product list. */
  showWelcomeFooter?: boolean;
};

export const SEEDS_CATEGORY_FILTERS = [
  "Category Type",
  "Variety",
  "Season",
  "Crop",
  "Germination",
  "Price",
  "Seller Rating"
] as const;

const SEEDS_LISTING: MarketCategoryListingConfig = {
  categoryId: "seeds",
  title: "Seeds & Saplings",
  inlineAdsEvery: 4,
  showWelcomeFooter: true,
  subCategories: [
    {
      id: "seeds",
      label: "Seeds",
      icon: require("../../../../assets/market/seeds.png"),
      fallbackIcon: "leaf-outline"
    },
    {
      id: "saplings",
      label: "Saplings",
      icon: require("../../../../assets/market/seeds-saplings.png"),
      fallbackIcon: "flower-outline"
    }
  ],
  filters: [...SEEDS_CATEGORY_FILTERS],
  products: [
    {
      id: "basmati-rice",
      subCategoryId: "seeds",
      title: "Basmati Rice",
      subtitle: "Basmati 370 | 45-55 Q/Ha",
      rating: 4.7,
      reviewLabel: "24.6k",
      eta: "10 MIN",
      germination: "Germination: 92-95%",
      weights: ["50kg", "25 Kg", "10kg"],
      discountPct: 8,
      price: 3200,
      mrp: 3500,
      unitPrice: 320
    },
    {
      id: "wheat",
      subCategoryId: "seeds",
      title: "Wheat",
      subtitle: "HD 3086 | 48-52 Q/Ha",
      rating: 4.6,
      reviewLabel: "18.2k",
      eta: "12 MIN",
      germination: "Germination: 90-93%",
      weights: ["50kg", "25 Kg", "10kg"],
      discountPct: 6,
      price: 2800,
      mrp: 2980,
      unitPrice: 280
    },
    {
      id: "bt-cotton",
      subCategoryId: "seeds",
      title: "BT Cotton",
      subtitle: "BG-II | 12-15 Q/Ha",
      rating: 4.8,
      reviewLabel: "31.1k",
      eta: "10 MIN",
      germination: "Germination: 85-88%",
      weights: ["450g", "225g"],
      discountPct: 10,
      price: 890,
      mrp: 990,
      unitPrice: 89
    },
    {
      id: "tomato-sapling",
      subCategoryId: "saplings",
      title: "Tomato Sapling",
      subtitle: "Hybrid | Tray of 50",
      rating: 4.5,
      reviewLabel: "9.4k",
      eta: "15 MIN",
      weights: ["50 pcs", "100 pcs"],
      discountPct: 5,
      price: 420,
      mrp: 450,
      unitPrice: 42
    },
    {
      id: "chilli-sapling",
      subCategoryId: "saplings",
      title: "Chilli Sapling",
      subtitle: "G4 Hybrid | Tray of 50",
      rating: 4.4,
      reviewLabel: "6.8k",
      eta: "14 MIN",
      weights: ["50 pcs", "100 pcs"],
      discountPct: 7,
      price: 380,
      mrp: 410,
      unitPrice: 38
    },
    {
      id: "maize",
      subCategoryId: "seeds",
      title: "Maize",
      subtitle: "DHM 117 | 35-40 Q/Ha",
      rating: 4.5,
      reviewLabel: "11.2k",
      eta: "10 MIN",
      germination: "Germination: 88-91%",
      weights: ["5kg", "2kg"],
      discountPct: 7,
      price: 620,
      mrp: 670,
      unitPrice: 124
    },
    {
      id: "paddy",
      subCategoryId: "seeds",
      title: "Paddy",
      subtitle: "BPT 5204 | 55-60 Q/Ha",
      rating: 4.6,
      reviewLabel: "15.4k",
      eta: "11 MIN",
      germination: "Germination: 90-94%",
      weights: ["25kg", "10kg"],
      discountPct: 6,
      price: 1450,
      mrp: 1540,
      unitPrice: 145
    },
    {
      id: "mustard",
      subCategoryId: "seeds",
      title: "Mustard",
      subtitle: "Pusa Bold | 12-14 Q/Ha",
      rating: 4.4,
      reviewLabel: "7.9k",
      eta: "12 MIN",
      germination: "Germination: 91-93%",
      weights: ["2kg", "1kg"],
      discountPct: 5,
      price: 340,
      mrp: 358,
      unitPrice: 170
    },
    {
      id: "brinjal-sapling",
      subCategoryId: "saplings",
      title: "Brinjal Sapling",
      subtitle: "Arka Samrat | Tray of 50",
      rating: 4.3,
      reviewLabel: "5.1k",
      eta: "16 MIN",
      weights: ["50 pcs", "100 pcs"],
      discountPct: 6,
      price: 360,
      mrp: 385,
      unitPrice: 36
    }
  ]
};

const FERTILIZERS_LISTING: MarketCategoryListingConfig = {
  categoryId: "fertilizers",
  title: "Fertilizers & Nutrients",
  subCategories: [
    {
      id: "npk",
      label: "NPK",
      icon: require("../../../../assets/market/fertilizers.png"),
      fallbackIcon: "flask-outline"
    },
    {
      id: "organic",
      label: "Organic",
      icon: require("../../../../assets/market/fertilizers-nutrients.png"),
      fallbackIcon: "leaf-outline"
    }
  ],
  filters: ["Brand", "NPK Ratio", "Crop"],
  products: [
    {
      id: "npk-19-19-19",
      subCategoryId: "npk",
      title: "NPK 19:19:19",
      subtitle: "Water soluble | 25 kg bag",
      rating: 4.6,
      reviewLabel: "12.3k",
      eta: "10 MIN",
      weights: ["50kg", "25 Kg", "10kg"],
      discountPct: 8,
      price: 1850,
      mrp: 2010,
      unitPrice: 185
    },
    {
      id: "urea",
      subCategoryId: "npk",
      title: "Urea",
      subtitle: "46% N | 45 kg bag",
      rating: 4.5,
      reviewLabel: "20.1k",
      eta: "11 MIN",
      weights: ["45kg", "25 Kg"],
      discountPct: 5,
      price: 268,
      mrp: 282,
      unitPrice: 268
    },
    {
      id: "vermi-compost",
      subCategoryId: "organic",
      title: "Vermi Compost",
      subtitle: "Premium grade | 40 kg",
      rating: 4.7,
      reviewLabel: "8.9k",
      eta: "12 MIN",
      weights: ["40kg", "20 Kg"],
      discountPct: 10,
      price: 320,
      mrp: 355,
      unitPrice: 32
    }
  ]
};

const LISTING_OVERRIDES: Record<string, MarketCategoryListingConfig> = {
  seeds: SEEDS_LISTING,
  fertilizers: FERTILIZERS_LISTING
};

function defaultListing(categoryId: string): MarketCategoryListingConfig {
  const item = getMarketCategoryItem(categoryId);
  const title = item?.label ?? "Products";
  return {
    categoryId,
    title,
    subCategories: [
      {
        id: "all",
        label: "All",
        icon: item?.icon as ImageSourcePropType | undefined,
        fallbackIcon: item?.fallbackIcon ?? "grid-outline"
      }
    ],
    filters: [...SEEDS_CATEGORY_FILTERS],
    products: [
      {
        id: `${categoryId}-1`,
        subCategoryId: "all",
        title: `${title} Item 1`,
        subtitle: "Premium quality | Fast delivery",
        rating: 4.5,
        reviewLabel: "2.4k",
        eta: "10 MIN",
        weights: ["1 unit", "2 units"],
        discountPct: 8,
        price: 1200,
        mrp: 1300,
        unitPrice: 120
      },
      {
        id: `${categoryId}-2`,
        subCategoryId: "all",
        title: `${title} Item 2`,
        subtitle: "Trusted seller | Best value",
        rating: 4.6,
        reviewLabel: "1.8k",
        eta: "12 MIN",
        weights: ["1 unit", "3 units"],
        discountPct: 6,
        price: 980,
        mrp: 1040,
        unitPrice: 98
      },
      {
        id: `${categoryId}-3`,
        subCategoryId: "all",
        title: `${title} Item 3`,
        subtitle: "Top rated | Verified store",
        rating: 4.7,
        reviewLabel: "3.1k",
        eta: "10 MIN",
        weights: ["1 unit"],
        discountPct: 10,
        price: 750,
        mrp: 830,
        unitPrice: 75
      }
    ]
  };
}

export function getMarketCategoryListingConfig(categoryId: string): MarketCategoryListingConfig {
  return LISTING_OVERRIDES[categoryId] ?? defaultListing(categoryId);
}
