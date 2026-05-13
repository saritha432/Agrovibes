import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { MarketplaceListing } from "../services/api";

export type CartLine = {
  listingId: number;
  cropName: string;
  vendor: string;
  unitPrice: number;
  unitLabel: string;
  quantity: number;
};

type CartContextValue = {
  items: CartLine[];
  itemCount: number;
  getQuantity: (listingId: number) => number;
  addFromListing: (listing: MarketplaceListing, index: number) => void;
  setQuantity: (listingId: number, quantity: number) => void;
  removeLine: (listingId: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function unitLabelForListing(listing: MarketplaceListing, index: number): string {
  const name = listing.cropName.toLowerCase();
  if (name.includes("fertilizer") || name.includes("npk")) return "/ 25 kg bag";
  if (name.includes("sprayer") || name.includes("kit")) return "/ unit";
  if (name.includes("seed")) return "/ 50g pack";
  if (name.includes("irrigation") || name.includes("drip")) return "/ kit";
  return index % 2 === 0 ? "/ 500g" : "/ unit";
}

const CartProviderInner = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartLine[]>([]);

  const addFromListing = useCallback((listing: MarketplaceListing, index: number) => {
    const unitLabel = unitLabelForListing(listing, index);
    setItems((prev) => {
      const existing = prev.find((p) => p.listingId === listing.id);
      if (existing) {
        return prev.map((p) =>
          p.listingId === listing.id ? { ...p, quantity: p.quantity + 1 } : p
        );
      }
      return [
        ...prev,
        {
          listingId: listing.id,
          cropName: listing.cropName,
          vendor: listing.district,
          unitPrice: listing.pricePerKg,
          unitLabel,
          quantity: 1
        }
      ];
    });
  }, []);

  const setQuantity = useCallback((listingId: number, quantity: number) => {
    const q = Math.max(0, Math.floor(quantity));
    setItems((prev) => {
      if (q === 0) return prev.filter((p) => p.listingId !== listingId);
      return prev.map((p) => (p.listingId === listingId ? { ...p, quantity: q } : p));
    });
  }, []);

  const removeLine = useCallback((listingId: number) => {
    setItems((prev) => prev.filter((p) => p.listingId !== listingId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const itemCount = useMemo(() => items.reduce((s, p) => s + p.quantity, 0), [items]);

  const getQuantity = useCallback(
    (listingId: number) => items.find((p) => p.listingId === listingId)?.quantity ?? 0,
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      itemCount,
      getQuantity,
      addFromListing,
      setQuantity,
      removeLine,
      clearCart
    }),
    [items, itemCount, getQuantity, addFromListing, setQuantity, removeLine, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  return <CartProviderInner>{children}</CartProviderInner>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
