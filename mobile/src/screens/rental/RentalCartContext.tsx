import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { fetchMyCart, saveMyCart, type RemoteRentalCartLine } from "../../services/api";
import { clearGuestRentalCache, mergeByKey, readRentalCartCache, writeRentalCartCache } from "../../cart/cartCache";
import type { RentalCatalogItem } from "./rentalCatalog";
import { clampRentalQuantity, rentalLineKey, type RentalCartLine } from "./rentalCart";

function sameLine(left: Pick<RentalCartLine, "listingId" | "option">, right: Pick<RentalCartLine, "listingId" | "option">) {
  return left.listingId === right.listingId && left.option === right.option;
}

export function lineFromCatalog(
  item: RentalCatalogItem,
  categoryTitle: string,
  option: string,
  quantity: number
): RentalCartLine {
  const chosen = option || item.options[0] || item.unitLabel;
  return {
    listingId: item.id,
    title: item.title,
    category: categoryTitle || item.title,
    option: chosen,
    quantity,
    unitPrice: item.price,
    unitLabel: item.unitLabel,
    mrp: item.mrp
  };
}

function withQuantity(prev: RentalCartLine[], line: RentalCartLine, quantity: number): RentalCartLine[] {
  const q = clampRentalQuantity(quantity);
  if (q <= 0) return prev.filter((item) => !sameLine(item, line));
  const existing = prev.find((item) => sameLine(item, line));
  if (existing) {
    return prev.map((item) => (sameLine(item, line) ? { ...item, ...line, quantity: q } : item));
  }
  return [{ ...line, quantity: q }, ...prev];
}

function asLine(raw: Partial<RentalCartLine> | RemoteRentalCartLine | Record<string, unknown>): RentalCartLine | null {
  const listingId = String(raw.listingId || "").trim();
  const option = String(raw.option || "").trim();
  const quantity = clampRentalQuantity(Number(raw.quantity));
  if (!listingId || !option || quantity <= 0) return null;
  return {
    listingId,
    title: String(raw.title || "Rental"),
    category: String(raw.category || ""),
    option,
    quantity,
    unitPrice: Number(raw.unitPrice) || 0,
    unitLabel: String(raw.unitLabel || "Day"),
    mrp: Number(raw.mrp) || Number(raw.unitPrice) || 0
  };
}

type RentalCartContextValue = {
  lines: RentalCartLine[];
  ready: boolean;
  itemCount: number;
  subtotal: number;
  getQuantity: (listingId: string, option?: string) => number;
  addItem: (item: RentalCatalogItem, categoryTitle: string, option?: string) => void;
  setQuantity: (listingId: string, option: string, quantity: number, item?: RentalCatalogItem, categoryTitle?: string) => void;
  removeLine: (listingId: string, option: string) => void;
  clearCart: () => Promise<RentalCartLine[]>;
  refreshFromServer: () => Promise<void>;
};

const RentalCartContext = createContext<RentalCartContextValue | null>(null);

export function RentalCartProvider({ children }: { children: React.ReactNode }) {
  const { token, user, loading: authLoading } = useAuth();
  const [lines, setLines] = useState<RentalCartLine[]>([]);
  const [ready, setReady] = useState(false);
  const linesRef = useRef<RentalCartLine[]>([]);
  const hydratedUserId = useRef<number | "guest" | null>(null);
  const dirtyRef = useRef(false);
  const serverAtRef = useRef<string | null>(null);
  const hydrateGen = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const applyLines = useCallback((next: RentalCartLine[], dirty: boolean) => {
    linesRef.current = next;
    setLines(next);
    dirtyRef.current = dirty;
    const userId = typeof hydratedUserId.current === "number" ? hydratedUserId.current : null;
    void writeRentalCartCache(userId, next);
  }, []);

  const pushRemote = useCallback(
    async (allowEmpty = false) => {
      const auth = tokenRef.current;
      const userId = typeof hydratedUserId.current === "number" ? hydratedUserId.current : null;
      if (!auth || !userId) return linesRef.current;
      try {
        const saved = await saveMyCart(auth, "rental", linesRef.current, {
          clientUpdatedAt: serverAtRef.current,
          allowEmpty
        });
        serverAtRef.current = saved.rentalUpdatedAt || new Date().toISOString();
        dirtyRef.current = false;
      } catch (error) {
        const status = (error as { status?: number })?.status;
        const cart = (error as { payload?: { cart?: { rental?: RemoteRentalCartLine[]; rentalUpdatedAt?: string } } })?.payload?.cart;
        if (status === 409 && cart?.rental) {
          const remote = cart.rental.map(asLine).filter((row): row is RentalCartLine => Boolean(row));
          applyLines(remote, false);
          serverAtRef.current = cart.rentalUpdatedAt || serverAtRef.current;
        }
      }
      return linesRef.current;
    },
    [applyLines]
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

  const persist = useCallback(
    (next: RentalCartLine[], allowEmpty = next.length === 0) => {
      applyLines(next, true);
      schedulePush(allowEmpty);
      return Promise.resolve(next);
    },
    [applyLines, schedulePush]
  );

  useEffect(() => {
    if (authLoading) return;
    const userId = user?.id ?? null;
    const gen = ++hydrateGen.current;

    if (!token || !userId) {
      if (hydratedUserId.current && hydratedUserId.current !== "guest") {
        applyLines([], false);
      }
      hydratedUserId.current = "guest";
      serverAtRef.current = null;
      void readRentalCartCache(null).then((cached) => {
        if (gen !== hydrateGen.current) return;
        const next = (cached as Partial<RentalCartLine>[]).map(asLine).filter((row): row is RentalCartLine => Boolean(row));
        applyLines(next, false);
        setReady(true);
      });
      return;
    }

    const guestLines = hydratedUserId.current === "guest" ? linesRef.current : [];
    if (hydratedUserId.current !== "guest" && hydratedUserId.current !== userId) {
      applyLines([], false);
    }
    hydratedUserId.current = userId;
    setReady(false);
    void (async () => {
      const cached = await readRentalCartCache(userId);
      if (gen !== hydrateGen.current) return;
      const cachedLines = (cached as Partial<RentalCartLine>[]).map(asLine).filter((row): row is RentalCartLine => Boolean(row));
      if (cachedLines.length && !guestLines.length) applyLines(cachedLines, false);
      try {
        const remote = await fetchMyCart(token);
        if (gen !== hydrateGen.current) return;
        const remoteLines = (remote.rental || []).map(asLine).filter((row): row is RentalCartLine => Boolean(row));
        const merged = guestLines.length
          ? mergeByKey(
              [...guestLines, ...cachedLines],
              remoteLines,
              (line) => rentalLineKey(line.listingId, line.option),
              (line) => line.quantity
            )
          : remoteLines;
        applyLines(merged, false);
        serverAtRef.current = remote.rentalUpdatedAt || new Date().toISOString();
        if (guestLines.length) {
          await clearGuestRentalCache();
          if (merged.length) await saveMyCart(token, "rental", merged, { clientUpdatedAt: serverAtRef.current });
        }
      } catch {
        if (gen !== hydrateGen.current) return;
        if (guestLines.length) {
          applyLines(
            mergeByKey(guestLines, cachedLines, (line) => rentalLineKey(line.listingId, line.option), (line) => line.quantity),
            true
          );
        }
      } finally {
        if (gen === hydrateGen.current) setReady(true);
      }
    })();
  }, [authLoading, token, user?.id, applyLines]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        if (dirtyRef.current) void pushRemote(linesRef.current.length === 0);
        return;
      }
      const auth = tokenRef.current;
      const userId = typeof hydratedUserId.current === "number" ? hydratedUserId.current : null;
      if (!auth || !userId) return;
      void (async () => {
        if (dirtyRef.current) await pushRemote(linesRef.current.length === 0);
        try {
          const remote = await fetchMyCart(auth);
          if (dirtyRef.current) return;
          const remoteLines = (remote.rental || []).map(asLine).filter((row): row is RentalCartLine => Boolean(row));
          applyLines(remoteLines, false);
          serverAtRef.current = remote.rentalUpdatedAt || serverAtRef.current;
        } catch {
          // keep local
        }
      })();
    });
    return () => sub.remove();
  }, [applyLines, pushRemote]);

  const getQuantity = useCallback((listingId: string, option?: string) => {
    if (option) {
      return lines.find((item) => sameLine(item, { listingId, option }))?.quantity ?? 0;
    }
    return lines.filter((item) => item.listingId === listingId).reduce((sum, item) => sum + item.quantity, 0);
  }, [lines]);

  const addItem = useCallback((item: RentalCatalogItem, categoryTitle: string, option?: string) => {
    const chosen = option || item.options[0] || item.unitLabel;
    const current = linesRef.current.find((line) => sameLine(line, { listingId: item.id, option: chosen }));
    persist(withQuantity(linesRef.current, lineFromCatalog(item, categoryTitle, chosen, 1), (current?.quantity ?? 0) + 1));
  }, [persist]);

  const setQuantity = useCallback(
    (listingId: string, option: string, quantity: number, item?: RentalCatalogItem, categoryTitle?: string) => {
      const existing = linesRef.current.find((line) => sameLine(line, { listingId, option }));
      const seed = existing || (item ? lineFromCatalog(item, categoryTitle || item.title, option, 1) : null);
      if (!seed) {
        persist(linesRef.current.filter((line) => !sameLine(line, { listingId, option })));
        return;
      }
      persist(withQuantity(linesRef.current, seed, quantity));
    },
    [persist]
  );

  const removeLine = useCallback(
    (listingId: string, option: string) => {
      persist(linesRef.current.filter((line) => !sameLine(line, { listingId, option })));
    },
    [persist]
  );

  const clearCart = useCallback(async () => {
    applyLines([], true);
    return pushRemote(true);
  }, [applyLines, pushRemote]);

  const refreshFromServer = useCallback(async () => {
    const auth = tokenRef.current;
    const userId = typeof hydratedUserId.current === "number" ? hydratedUserId.current : null;
    if (!auth || !userId) return;
    if (dirtyRef.current) await pushRemote(linesRef.current.length === 0);
    try {
      const remote = await fetchMyCart(auth);
      if (dirtyRef.current) return;
      const remoteLines = (remote.rental || []).map(asLine).filter((row): row is RentalCartLine => Boolean(row));
      applyLines(remoteLines, false);
      serverAtRef.current = remote.rentalUpdatedAt || serverAtRef.current;
    } catch {
      // keep local
    }
  }, [applyLines, pushRemote]);

  const itemCount = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), [lines]);

  const value = useMemo(
    () => ({
      lines,
      ready,
      itemCount,
      subtotal,
      getQuantity,
      addItem,
      setQuantity,
      removeLine,
      clearCart,
      refreshFromServer
    }),
    [lines, ready, itemCount, subtotal, getQuantity, addItem, setQuantity, removeLine, clearCart, refreshFromServer]
  );

  return <RentalCartContext.Provider value={value}>{children}</RentalCartContext.Provider>;
}

export function useRentalCart() {
  const ctx = useContext(RentalCartContext);
  if (!ctx) throw new Error("useRentalCart must be used within RentalCartProvider");
  return ctx;
}
