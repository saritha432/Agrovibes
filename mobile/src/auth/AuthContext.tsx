import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { AppState } from "react-native";
import { fetchAuthMe } from "../services/api";
import { clearReelPreviewCache } from "../utils/reelPreviewThumb";

export type UserRole = "student" | "instructor" | "admin";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
  website?: string;
  dateOfBirth?: string;
  preferredLanguage?: string;
  locationLabel?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  signIn: (payload: { token: string; user: AuthUser }) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const STORAGE_KEY = "agrovibes.auth";

const AuthContext = React.createContext<AuthState | null>(null);

async function persistSession(token: string, user: AuthUser) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const tokenRef = React.useRef<string | null>(null);
  tokenRef.current = token;

  const applyServerUser = React.useCallback(async (t: string, serverUser: AuthUser) => {
    setToken(t);
    setUser(serverUser);
    await persistSession(t, serverUser);
  }, []);

  const refreshUser = React.useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;
    const me = await fetchAuthMe(t);
    if (!me.user) return;
    await applyServerUser(t, me.user as AuthUser);
  }, [applyServerUser]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (!raw) {
          setLoading(false);
          return;
        }
        const parsed = JSON.parse(raw) as { token?: string; user?: AuthUser } | null;
        if (!parsed?.token || !parsed?.user) {
          await AsyncStorage.removeItem(STORAGE_KEY);
          setToken(null);
          setUser(null);
          setLoading(false);
          return;
        }
        setToken(parsed.token);
        setUser(parsed.user);
        try {
          const me = await fetchAuthMe(parsed.token);
          if (!mounted) return;
          if (me.user) {
            setUser(me.user as AuthUser);
            await persistSession(parsed.token, me.user as AuthUser);
          }
        } catch {
          // Keep cached user when offline or server unreachable.
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!token) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshUser().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [token, refreshUser]);

  const signIn = React.useCallback(async (payload: { token: string; user: AuthUser }) => {
    await applyServerUser(payload.token, payload.user);
  }, [applyServerUser]);

  const signOut = React.useCallback(async () => {
    clearReelPreviewCache();
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const updateUser = React.useCallback(async (patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...patch };
      const t = tokenRef.current;
      if (t) {
        persistSession(t, merged).catch(() => {});
      }
      return merged;
    });
  }, []);

  const value: AuthState = { token, user, loading, signIn, signOut, updateUser, refreshUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

