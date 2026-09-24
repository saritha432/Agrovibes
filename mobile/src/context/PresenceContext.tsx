import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { fetchPresence, type PresenceEntry } from "../services/api";
import {
  emitPresenceActive,
  emitPresenceAway,
  onPresenceUpdate,
  onSocketConnectionChange
} from "../services/socketChat";

type PresenceState = { online: boolean; lastSeenAt: string | null };

type PresenceContextValue = {
  isOnline: (userId?: number | null) => boolean;
  lastSeenAt: (userId?: number | null) => string | null;
  watch: (userIds: Array<number | null | undefined>) => void;
};

const PresenceContext = createContext<PresenceContextValue | null>(null);

function parseUserId(value: number | null | undefined) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [byId, setById] = useState<Record<number, PresenceState>>({});
  const watchedRef = useRef(new Set<number>());
  const pendingRef = useRef(new Set<number>());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selfId = parseUserId(user?.id);

  const applyEntries = useCallback((entries: PresenceEntry[]) => {
    setById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const entry of entries) {
        const id = parseUserId(entry.userId);
        if (!id) continue;
        const state = { online: Boolean(entry.online), lastSeenAt: entry.lastSeenAt || null };
        const existing = next[id];
        if (existing?.online === state.online && existing?.lastSeenAt === state.lastSeenAt) continue;
        next[id] = state;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  const flushWatch = useCallback(() => {
    if (!token) return;
    const ids = [...pendingRef.current];
    pendingRef.current.clear();
    if (!ids.length) return;
    void fetchPresence(token, ids).then(applyEntries).catch(() => {});
  }, [applyEntries, token]);

  const watch = useCallback(
    (userIds: Array<number | null | undefined>) => {
      let added = false;
      for (const raw of userIds) {
        const id = parseUserId(raw);
        if (!id || id === selfId || watchedRef.current.has(id)) continue;
        watchedRef.current.add(id);
        pendingRef.current.add(id);
        added = true;
      }
      if (!added) return;
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(flushWatch, 40);
    },
    [flushWatch, selfId]
  );

  useEffect(() => {
    return onPresenceUpdate((payload) => {
      const id = parseUserId(payload?.userId);
      if (!id) return;
      setById((prev) => ({
        ...prev,
        [id]: { online: Boolean(payload.online), lastSeenAt: payload.lastSeenAt || null }
      }));
    });
  }, []);

  useEffect(() => {
    if (!token) {
      watchedRef.current.clear();
      pendingRef.current.clear();
      setById({});
      return;
    }
    return onSocketConnectionChange((connected) => {
      if (!connected) return;
      if (AppState.currentState === "active") emitPresenceActive();
      else emitPresenceAway();
      const ids = [...watchedRef.current];
      if (ids.length) {
        void fetchPresence(token, ids).then(applyEntries).catch(() => {});
      }
    });
  }, [applyEntries, token]);

  useEffect(() => {
    if (!token) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") emitPresenceActive();
      else emitPresenceAway();
    });
    if (AppState.currentState !== "active") emitPresenceAway();
    return () => sub.remove();
  }, [token]);

  useEffect(() => {
    if (!token || Platform.OS !== "web") return;
    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") emitPresenceActive();
      else emitPresenceAway();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [token]);

  const value = useMemo<PresenceContextValue>(
    () => ({
      isOnline: (userId) => {
        const id = parseUserId(userId);
        if (!id || id === selfId) return false;
        return Boolean(byId[id]?.online);
      },
      lastSeenAt: (userId) => {
        const id = parseUserId(userId);
        if (!id) return null;
        return byId[id]?.lastSeenAt || null;
      },
      watch
    }),
    [byId, selfId, watch]
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) {
    return {
      isOnline: () => false,
      lastSeenAt: () => null,
      watch: () => {}
    };
  }
  return ctx;
}

export function useIsOnline(userId?: number | null) {
  const { isOnline, watch } = usePresence();
  useEffect(() => {
    watch([userId]);
  }, [userId, watch]);
  return isOnline(userId);
}
