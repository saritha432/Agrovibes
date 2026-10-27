import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { fetchMyLocation, updateMyLocation, type SavedUserLocation } from "../services/api";

export const UNSAVED_LOCATION_LABEL = "Add location";

export type PickedLocation = {
  label: string;
  lat: number | null;
  lng: number | null;
  city?: string | null;
  state?: string | null;
  postal?: string | null;
};

type UserLocationContextValue = {
  ready: boolean;
  hasSaved: boolean;
  label: string;
  shortLabel: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
  state: string | null;
  postal: string | null;
  saveLocation: (next: PickedLocation) => Promise<void>;
  refreshLocation: () => Promise<void>;
};

const UserLocationContext = createContext<UserLocationContextValue | null>(null);

export function parseAddressParts(label: string): { city: string | null; state: string | null; postal: string | null } {
  const parts = String(label || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const postalPart = parts.find((part) => /^\d{5,6}$/.test(part.replace(/\s/g, ""))) || null;
  const countryAt = parts.findIndex((part) => /india|भारत/i.test(part));
  const state =
    countryAt > 0 ? parts[countryAt - (postalPart && parts[countryAt - 1] === postalPart ? 2 : 1)] || null : parts.length >= 2 ? parts[parts.length - 2] : null;
  const city =
    countryAt > 1 ? parts[Math.max(0, countryAt - (postalPart ? 3 : 2))] || null : parts.length >= 3 ? parts[parts.length - 3] : parts[0] || null;
  return { city, state, postal: postalPart };
}

function shortFrom(location: PickedLocation | null) {
  if (!location?.label) return UNSAVED_LOCATION_LABEL;
  if (location.city && location.state) return `${location.city}, ${location.state}`;
  const first = location.label.split(",")[0]?.trim();
  return first || location.label;
}

function fromUser(user: { locationLabel?: string; locationLat?: number; locationLng?: number; locationCity?: string; locationState?: string; locationPostal?: string } | null): PickedLocation | null {
  const label = String(user?.locationLabel || "").trim();
  if (!label) return null;
  const parsed = parseAddressParts(label);
  return {
    label,
    lat: Number.isFinite(Number(user?.locationLat)) ? Number(user?.locationLat) : null,
    lng: Number.isFinite(Number(user?.locationLng)) ? Number(user?.locationLng) : null,
    city: user?.locationCity || parsed.city,
    state: user?.locationState || parsed.state,
    postal: user?.locationPostal || parsed.postal
  };
}

function fromApi(row: SavedUserLocation | null | undefined): PickedLocation | null {
  const label = String(row?.label || "").trim();
  if (!label) return null;
  const parsed = parseAddressParts(label);
  return {
    label,
    lat: Number.isFinite(Number(row?.lat)) ? Number(row?.lat) : null,
    lng: Number.isFinite(Number(row?.lng)) ? Number(row?.lng) : null,
    city: row?.city || parsed.city,
    state: row?.state || parsed.state,
    postal: row?.postal || parsed.postal
  };
}

export function UserLocationProvider({ children }: { children: React.ReactNode }) {
  const { user, token, loading, updateUser, refreshUser } = useAuth();
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [ready, setReady] = useState(false);
  const userIdRef = useRef<number | null>(null);
  const hydrateGen = useRef(0);
  const locationRef = useRef<PickedLocation | null>(null);
  locationRef.current = location;

  useEffect(() => {
    if (loading) return;
    const userId = user?.id ?? null;
    if (!token || !userId) {
      userIdRef.current = null;
      setLocation(null);
      setReady(true);
      return;
    }
    const guestLocation = userIdRef.current == null ? locationRef.current : null;
    const seeded = fromUser(user) || guestLocation;
    if (userIdRef.current !== userId) {
      userIdRef.current = userId;
      setLocation(seeded);
    }
    const gen = ++hydrateGen.current;
    setReady(false);
    void fetchMyLocation(token)
      .then((data) => {
        if (gen !== hydrateGen.current || userIdRef.current !== userId) return;
        const next = fromApi(data.location);
        if (next) setLocation(next);
        else if (guestLocation?.label) {
          void updateMyLocation(token, guestLocation).catch(() => undefined);
        }
        setReady(true);
      })
      .catch(() => {
        if (gen !== hydrateGen.current) return;
        if (seeded) setLocation(seeded);
        setReady(true);
      });
  }, [loading, token, user?.id]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !token || !user?.id) return;
      void fetchMyLocation(token)
        .then((data) => {
          const next = fromApi(data.location);
          if (next) setLocation(next);
        })
        .catch(() => undefined);
      void refreshUser();
    });
    return () => sub.remove();
  }, [token, user?.id, refreshUser]);

  const saveLocation = useCallback(
    async (next: PickedLocation) => {
      const label = String(next.label || "").trim();
      if (!label) throw new Error("A location address is required.");
      const parsed = parseAddressParts(label);
      const payload: PickedLocation = {
        label,
        lat: next.lat,
        lng: next.lng,
        city: next.city || parsed.city,
        state: next.state || parsed.state,
        postal: next.postal || parsed.postal
      };
      const previous = locationRef.current;
      setLocation(payload);
      if (!token) {
        await updateUser({
          locationLabel: payload.label,
          locationLat: payload.lat ?? undefined,
          locationLng: payload.lng ?? undefined,
          locationCity: payload.city ?? undefined,
          locationState: payload.state ?? undefined,
          locationPostal: payload.postal ?? undefined
        });
        return;
      }
      try {
        const saved = await updateMyLocation(token, payload);
        const confirmed = fromApi(saved.location) || payload;
        setLocation(confirmed);
        await updateUser({
          locationLabel: confirmed.label,
          locationLat: confirmed.lat ?? undefined,
          locationLng: confirmed.lng ?? undefined,
          locationCity: confirmed.city ?? undefined,
          locationState: confirmed.state ?? undefined,
          locationPostal: confirmed.postal ?? undefined
        });
      } catch (error) {
        setLocation(previous);
        throw error;
      }
    },
    [token, updateUser]
  );

  const refreshLocation = useCallback(async () => {
    if (!token) return;
    const data = await fetchMyLocation(token);
    const next = fromApi(data.location);
    if (next) setLocation(next);
  }, [token]);

  const value = useMemo<UserLocationContextValue>(() => {
    const hasSaved = Boolean(location?.label);
    return {
      ready,
      hasSaved,
      label: hasSaved ? location!.label : UNSAVED_LOCATION_LABEL,
      shortLabel: shortFrom(location),
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      city: location?.city ?? null,
      state: location?.state ?? null,
      postal: location?.postal ?? null,
      saveLocation,
      refreshLocation
    };
  }, [ready, location, saveLocation, refreshLocation]);

  return <UserLocationContext.Provider value={value}>{children}</UserLocationContext.Provider>;
}

export function useUserLocation() {
  const ctx = useContext(UserLocationContext);
  if (!ctx) throw new Error("useUserLocation must be used within UserLocationProvider");
  return ctx;
}
