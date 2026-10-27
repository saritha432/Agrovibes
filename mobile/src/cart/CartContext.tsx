import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { fetchMyCart, saveMyCart, type MarketplaceListing, type RemoteMarketCartLine } from "../services/api";
import { clearGuestMarketCache, mergeByKey, readMarketCartCache, writeMarketCartCache } from "./cartCache";

export type CartLine = {
  id: string;
  cropName: string;
  vendor: string;
  unitPrice: number;
  unitLabel: string;
  quantity: number;
  maxQuantity?: number;
};

export type CartItemInput = {
  id: string;
  cropName: string;
  vendor: string;
  unitPrice: number;
  unitLabel: string;
  maxQuantity?: number;
};

type CartContextValue = {
  items: CartLine[];
  itemCount: number;
  ready: boolean;
  getQuantity: (id: string) => number;
  addItem: (item: CartItemInput) => void;
  addFromListing: (listing: MarketplaceListing, index: number, maxQuantity?: number) => void;
  setQuantity: (id: string, quantity: number, maxQuantity?: number) => void;
  removeLine: (id: string) => void;
  clearCart: () => void;
  refreshFromServer: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function marketplaceCartId(listingId: number | string) {
  return `listing:${listingId}`;
}

export function catalogCartId(productId: string, variant?: string) {
  return variant ? `catalog:${productId}|${variant}` : `catalog:${productId}`;
}

function unitLabelForListing(listing: MarketplaceListing, index: number): string {
  const name = listing.cropName.toLowerCase();
  if (name.includes("fertilizer") || name.includes("npk")) return "/ 25 kg bag";
  if (name.includes("sprayer") || name.includes("kit")) return "/ unit";
  if (name.includes("seed")) return "/ 50g pack";
  if (name.includes("irrigation") || name.includes("drip")) return "/ kit";
  return index % 2 === 0 ? "/ 500g" : "/ unit";
}

function clampQuantity(quantity: number, maxQuantity?: number) {
  const max = maxQuantity != null && Number.isFinite(maxQuantity) ? Math.max(0, Math.floor(maxQuantity)) : Number.POSITIVE_INFINITY;
  const q = Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0));
  return Math.min(q, max);
}

function asLine(raw: Partial<CartLine> | RemoteMarketCartLine | Record<string, unknown>): CartLine | null {
  const id = String(raw.id || "").trim();
  const quantity = clampQuantity(Number(raw.quantity));
  if (!id || quantity <= 0) return null;
  return {
    id,
    cropName: String(raw.cropName || "Item"),
    vendor: String(raw.vendor || ""),
    unitPrice: Number(raw.unitPrice) || 0,
    unitLabel: String(raw.unitLabel || "/ unit"),
    quantity,
    maxQuantity: raw.maxQuantity == null ? undefined : clampQuantity(Number(raw.maxQuantity))
  };
}

const CartProviderInner = ({ children }: { children: React.ReactNode }) => {
  const { token, user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const itemsRef = useRef<CartLine[]>([]);
  const hydratedUserId = useRef<number | "guest" | null>(null);
  const dirtyRef = useRef(false);
  const serverAtRef = useRef<string | null>(null);
  const hydrateGen = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const applyItems = useCallback((next: CartLine[], dirty: boolean) => {
    itemsRef.current = next;
    setItems(next);
    dirtyRef.current = dirty;
    const userId = typeof hydratedUserId.current === "number" ? hydratedUserId.current : null;
    void writeMarketCartCache(userId, next);
  }, []);

  const pushRemote = useCallback(
    async (allowEmpty = false) => {
      const auth = tokenRef.current;
      const userId = typeof hydratedUserId.current === "number" ? hydratedUserId.current : null;
      if (!auth || !userId) return;
      try {
        const saved = await saveMyCart(auth, "market", itemsRef.current, {
          clientUpdatedAt: serverAtRef.current,
          allowEmpty
        });
        serverAtRef.current = saved.marketUpdatedAt || new Date().toISOString();
        dirtyRef.current = false;
        void writeMarketCartCache(userId, itemsRef.current);
      } catch (error) {
        const status = (error as { status?: number })?.status;
        const cart = (error as { payload?: { cart?: { market?: RemoteMarketCartLine[]; marketUpdatedAt?: string } } })?.payload?.cart;
        if (status === 409 && cart?.market) {
          const remote = cart.market.map(asLine).filter((row): row is CartLine => Boolean(row));
          applyItems(remote, false);
          serverAtRef.current = cart.marketUpdatedAt || serverAtRef.current;
        }
      }
    },
    [applyItems]
  );

  const schedulePush = useCallback(
    (allowEmpty = false) => {
      if (hydratedUserId.current == null || hydratedUserId.current === "guest") return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void pushRemote(allowEmpty);
      }, 350);
    },
    [pushRemote]
  );

  useEffect(() => {
    if (authLoading) return;
    const userId = user?.id ?? null;
    const gen = ++hydrateGen.current;

    if (!token || !userId) {
      if (hydratedUserId.current && hydratedUserId.current !== "guest") {
        applyItems([], false);
      }
      hydratedUserId.current = "guest";
      serverAtRef.current = null;
      void readMarketCartCache(null).then((cached) => {
        if (gen !== hydrateGen.current) return;
        const lines = (cached as Partial<CartLine>[]).map(asLine).filter((row): row is CartLine => Boolean(row));
        applyItems(lines, false);
        setReady(true);
      });
      return;
    }

    const guestLines = hydratedUserId.current === "guest" ? itemsRef.current : [];
    if (hydratedUserId.current !== "guest" && hydratedUserId.current !== userId) {
      applyItems([], false);
    }
    hydratedUserId.current = userId;
    setReady(false);
    void (async () => {
      const cached = await readMarketCartCache(userId);
      if (gen !== hydrateGen.current) return;
      const cachedLines = (cached as Partial<CartLine>[]).map(asLine).filter((row): row is CartLine => Boolean(row));
      if (cachedLines.length && !guestLines.length) applyItems(cachedLines, false);
      try {
        const remote = await fetchMyCart(token);
        if (gen !== hydrateGen.current) return;
        const remoteLines = (remote.market || []).map(asLine).filter((row): row is CartLine => Boolean(row));
        const merged = guestLines.length ? mergeByKey([...guestLines, ...cachedLines], remoteLines, (line) => line.id, (line) => line.quantity) : remoteLines;
        applyItems(merged, false);
        serverAtRef.current = remote.marketUpdatedAt || new Date().toISOString();
        if (guestLines.length) {
          await clearGuestMarketCache();
          if (merged.length) await saveMyCart(token, "market", merged, { clientUpdatedAt: serverAtRef.current });
        }
      } catch {
        if (gen !== hydrateGen.current) return;
        if (guestLines.length) applyItems(mergeByKey(guestLines, cachedLines, (line) => line.id, (line) => line.quantity), true);
      } finally {
        if (gen === hydrateGen.current) setReady(true);
      }
    })();
  }, [authLoading, token, user?.id, applyItems]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        if (dirtyRef.current) void pushRemote(itemsRef.current.length === 0);
        return;
      }
      const auth = tokenRef.current;
      const userId = typeof hydratedUserId.current === "number" ? hydratedUserId.current : null;
      if (!auth || !userId) return;
      void (async () => {
        if (dirtyRef.current) await pushRemote(itemsRef.current.length === 0);
        try {
          const remote = await fetchMyCart(auth);
          const remoteLines = (remote.market || []).map(asLine).filter((row): row is CartLine => Boolean(row));
          if (dirtyRef.current) return;
          applyItems(remoteLines, false);
          serverAtRef.current = remote.marketUpdatedAt || serverAtRef.current;
        } catch {
          // keep local
        }
      })();
    });
    return () => sub.remove();
  }, [applyItems, pushRemote]);

  const addItem = useCallback(
    (item: CartItemInput) => {
      const existing = itemsRef.current.find((p) => p.id === item.id);
      const nextQty = clampQuantity((existing?.quantity ?? 0) + 1, existing?.maxQuantity ?? item.maxQuantity);
      if (existing && nextQty === existing.quantity) return;
      const next = existing
        ? itemsRef.current.map((p) => (p.id === item.id ? { ...p, quantity: nextQty } : p))
        : nextQty <= 0
          ? itemsRef.current
          : [
              ...itemsRef.current,
              {
                id: item.id,
                cropName: item.cropName,
                vendor: item.vendor,
                unitPrice: item.unitPrice,
                unitLabel: item.unitLabel,
                quantity: nextQty,
                maxQuantity: item.maxQuantity
              }
            ];
      applyItems(next, true);
      schedulePush();
    },
    [applyItems, schedulePush]
  );

  const addFromListing = useCallback(
    (listing: MarketplaceListing, index: number, maxQuantity?: number) => {
      addItem({
        id: marketplaceCartId(listing.id),
        cropName: listing.cropName,
        vendor: listing.district,
        unitPrice: listing.pricePerKg,
        unitLabel: unitLabelForListing(listing, index),
        maxQuantity
      });
    },
    [addItem]
  );

  const setQuantity = useCallback(
    (id: string, quantity: number, maxQuantity?: number) => {
      const existing = itemsRef.current.find((p) => p.id === id);
      if (!existing) return;
      const max = maxQuantity ?? existing.maxQuantity;
      const q = clampQuantity(quantity, max);
      const next =
        q === 0
          ? itemsRef.current.filter((p) => p.id !== id)
          : itemsRef.current.map((p) => (p.id === id ? { ...p, quantity: q, maxQuantity: max } : p));
      applyItems(next, true);
      schedulePush(q === 0 && next.length === 0);
    },
    [applyItems, schedulePush]
  );

  const removeLine = useCallback(
    (id: string) => {
      const next = itemsRef.current.filter((p) => p.id !== id);
      applyItems(next, true);
      schedulePush(next.length === 0);
    },
    [applyItems, schedulePush]
  );

  const clearCart = useCallback(() => {
    applyItems([], true);
    void pushRemote(true);
  }, [applyItems, pushRemote]);

  const refreshFromServer = useCallback(async () => {
    const auth = tokenRef.current;
    const userId = typeof hydratedUserId.current === "number" ? hydratedUserId.current : null;
    if (!auth || !userId) return;
    if (dirtyRef.current) await pushRemote(itemsRef.current.length === 0);
    try {
      const remote = await fetchMyCart(auth);
      if (dirtyRef.current) return;
      const remoteLines = (remote.market || []).map(asLine).filter((row): row is CartLine => Boolean(row));
      applyItems(remoteLines, false);
      serverAtRef.current = remote.marketUpdatedAt || serverAtRef.current;
    } catch {
      // keep local
    }
  }, [applyItems, pushRemote]);

  const itemCount = useMemo(() => items.reduce((s, p) => s + p.quantity, 0), [items]);
  const getQuantity = useCallback((id: string) => items.find((p) => p.id === id)?.quantity ?? 0, [items]);

  const value = useMemo(
    () => ({
      items,
      itemCount,
      ready,
      getQuantity,
      addItem,
      addFromListing,
      setQuantity,
      removeLine,
      clearCart,
      refreshFromServer
    }),
    [items, itemCount, ready, getQuantity, addItem, addFromListing, setQuantity, removeLine, clearCart, refreshFromServer]
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
