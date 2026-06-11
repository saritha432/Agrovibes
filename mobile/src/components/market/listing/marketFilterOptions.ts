import type { ImageSourcePropType } from "react-native";

export type FilterSelectionValue = string | string[];

export type FilterCardOption = {
  id: string;
  label: string;
  image: ImageSourcePropType;
};

export const CROP_FILTER_OPTIONS = [
  "Wheat",
  "Maize",
  "Cotton",
  "Cabbage",
  "Barley",
  "Oats",
  "Jowar",
  "Bajra",
  "Ragi",
  "Green Gram",
  "Chickpea",
  "Kidney Bean",
  "Pigeon Pea",
  "Black Gram",
  "Pea",
  "Gram",
  "Brinjal",
  "Bottle Gourd"
] as const;

export const MARKET_FILTER_OPTIONS: Record<string, string[]> = {
  Variety: ["Hybrid", "Local", "Certified", "Organic"],
  "Category Type": ["Saplings", "Seed"],
  Crop: [...CROP_FILTER_OPTIONS],
  Season: ["Summer", "Winter", "Rain", "Spring"],
  Germination: ["85%+", "90%+", "95%+"],
  "Seller Rating": ["4.5+", "4.0+", "3.5+"],
  Price: ["Low to High", "High to Low"],
  Brand: ["All Brands", "Premium", "Budget"],
  "NPK Ratio": ["19:19:19", "20:20:20", "Custom"]
};

export const CATEGORY_TYPE_CARD_OPTIONS: FilterCardOption[] = [
  {
    id: "Saplings",
    label: "Saplings",
    image: require("../../../../assets/market/seeds-saplings.png")
  },
  {
    id: "Seed",
    label: "Seed",
    image: require("../../../../assets/market/seeds.png")
  }
];

export const FILTERS_WITH_CARD_UI = new Set(["Category Type"]);
export const FILTERS_WITH_MULTI_SELECT = new Set(["Crop"]);

export function getFilterOptions(filterLabel: string): string[] {
  return MARKET_FILTER_OPTIONS[filterLabel] ?? ["Option 1", "Option 2", "Option 3"];
}

export function usesCardFilterUi(filterLabel: string): boolean {
  return FILTERS_WITH_CARD_UI.has(filterLabel);
}

export function usesMultiSelectFilter(filterLabel: string): boolean {
  return FILTERS_WITH_MULTI_SELECT.has(filterLabel);
}

export function filterHasValue(value: FilterSelectionValue | undefined): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return value.length > 0;
}

export function formatFilterChipLabel(
  filterLabel: string,
  value: FilterSelectionValue | undefined
): string {
  if (!filterHasValue(value)) return filterLabel;
  if (Array.isArray(value)) {
    if (value.length === 1) return value[0];
    if (value.length === 2) return `${value[0]}, ${value[1]}`;
    return `${value.length} selected`;
  }
  return value;
}

export function isOptionSelected(
  value: FilterSelectionValue | undefined,
  option: string
): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.includes(option);
  return value === option;
}
