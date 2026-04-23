import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { useAuth } from "../auth/AuthContext";
import { AppRole, defaultOnboardingState, OnboardingState } from "./types";

const STORAGE_KEY = "agrovibes.onboarding.v1";

type StoreShape = { byUserId: Record<string, OnboardingState> };

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { byUserId: {} };
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed || typeof parsed !== "object" || !parsed.byUserId) return { byUserId: {} };
    return parsed;
  } catch {
    return { byUserId: {} };
  }
}

async function writeStore(store: StoreShape) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

interface OnboardingContextValue {
  state: OnboardingState;
  loading: boolean;
  setPersonalInfoCompleted: () => Promise<void>;
  setAppRole: (role: AppRole) => Promise<void>;
  completeBuyerStep: (step: keyof OnboardingState["buyer"]) => Promise<void>;
  completeSellerStep: (step: keyof OnboardingState["seller"]) => Promise<void>;
  completeExpertStep: (step: keyof OnboardingState["expert"]) => Promise<void>;
  completeSecurity: () => Promise<void>;
  /** Dev / sign-out cleanup: remove saved onboarding for current user */
  clearForCurrentUser: () => Promise<void>;
}

const OnboardingContext = React.createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = React.useState<OnboardingState>(defaultOnboardingState());
  const [loading, setLoading] = React.useState(true);

  const userKey = user ? String(user.id) : null;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userKey) {
        setState(defaultOnboardingState());
        setLoading(false);
        return;
      }
      setLoading(true);
      const store = await readStore();
      if (cancelled) return;
      const next = store.byUserId[userKey] ?? defaultOnboardingState();
      setState(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  const persist = React.useCallback(
    async (updater: (prev: OnboardingState) => OnboardingState) => {
      if (!userKey) return;
      const store = await readStore();
      const prev = store.byUserId[userKey] ?? defaultOnboardingState();
      const merged = updater(prev);
      store.byUserId[userKey] = merged;
      await writeStore(store);
      setState(merged);
    },
    [userKey]
  );

  const setPersonalInfoCompleted = React.useCallback(async () => {
    await persist((p) => ({ ...p, personalInfoCompleted: true }));
  }, [persist]);

  const setAppRole = React.useCallback(
    async (role: AppRole) => {
      const fresh = defaultOnboardingState();
      await persist((p) => ({
        ...p,
        appRole: role,
        buyer: role === "buyer" ? p.buyer : fresh.buyer,
        seller: role === "seller" ? p.seller : fresh.seller,
        expert: role === "expert" ? p.expert : fresh.expert
      }));
    },
    [persist]
  );

  const completeBuyerStep = React.useCallback(
    async (step: keyof OnboardingState["buyer"]) => {
      await persist((p) => ({
        ...p,
        buyer: { ...p.buyer, [step]: true }
      }));
    },
    [persist]
  );

  const completeSellerStep = React.useCallback(
    async (step: keyof OnboardingState["seller"]) => {
      await persist((p) => ({
        ...p,
        seller: { ...p.seller, [step]: true }
      }));
    },
    [persist]
  );

  const completeExpertStep = React.useCallback(
    async (step: keyof OnboardingState["expert"]) => {
      await persist((p) => ({
        ...p,
        expert: { ...p.expert, [step]: true }
      }));
    },
    [persist]
  );

  const completeSecurity = React.useCallback(async () => {
    await persist((p) => ({ ...p, securityCompleted: true }));
  }, [persist]);

  const clearForCurrentUser = React.useCallback(async () => {
    if (!userKey) return;
    const store = await readStore();
    delete store.byUserId[userKey];
    await writeStore(store);
    setState(defaultOnboardingState());
  }, [userKey]);

  const value = React.useMemo(
    () => ({
      state,
      loading,
      setPersonalInfoCompleted,
      setAppRole,
      completeBuyerStep,
      completeSellerStep,
      completeExpertStep,
      completeSecurity,
      clearForCurrentUser
    }),
    [
      state,
      loading,
      setPersonalInfoCompleted,
      setAppRole,
      completeBuyerStep,
      completeSellerStep,
      completeExpertStep,
      completeSecurity,
      clearForCurrentUser
    ]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = React.useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
