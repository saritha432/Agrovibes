import type { MarketListingProduct } from "./marketCategoryListingConfig";

export type CategoryListingRow =
  | {
      type: "product-pair";
      id: string;
      left: MarketListingProduct;
      right?: MarketListingProduct;
    }
  | {
      type: "ad";
      id: string;
      adIndex: number;
    };

export function buildCategoryListingRows(
  products: MarketListingProduct[],
  adsEvery = 4
): CategoryListingRow[] {
  if (adsEvery <= 0) {
    return pairProducts(products);
  }

  const rows: CategoryListingRow[] = [];
  let adIndex = 0;

  for (let i = 0; i < products.length; i += adsEvery) {
    const chunk = products.slice(i, i + adsEvery);
    rows.push(...pairProducts(chunk));
    if (chunk.length === adsEvery) {
      rows.push({ type: "ad", id: `listing-ad-${i}`, adIndex: adIndex++ });
    }
  }

  return rows;
}

function pairProducts(products: MarketListingProduct[]): CategoryListingRow[] {
  const rows: CategoryListingRow[] = [];
  for (let i = 0; i < products.length; i += 2) {
    const left = products[i];
    const right = products[i + 1];
    rows.push({
      type: "product-pair",
      id: `pair-${left.id}-${right?.id ?? "solo"}`,
      left,
      right
    });
  }
  return rows;
}
