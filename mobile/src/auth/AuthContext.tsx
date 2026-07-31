import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { fetchMyAccount, warmUpServer } from "../services/api";
import { clearReelPreviewCache } from "../utils/reelPreviewThumb";
import { upsertSavedLogin } from "../utils/savedLogins";

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
  accountStatus?: "active" | "deactivated";
  isPrivate?: boolean;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  signIn: (payload: { token: string; user: AuthUser }) => Promise<void>;
  refreshToken: (token: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
}

const STORAGE_KEY = "agrovibes.auth";

const AuthContext = React.createContext<AuthState | null>(null);

async function persistAuth(nextToken: string | null, nextUser: AuthUser | null) {
  try {
    if (!nextToken || !nextUser) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: nextToken,
        user: nextUser
      })
    );
  } catch {
    // ignore persistence failures — in-memory auth still works for this session
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  /** Keep latest token for stable callbacks (avoids recreating updateUser/refreshUser on every token change). */
  const tokenRef = React.useRef<string | null>(null);
  tokenRef.current = token;

  /** Prevent overlapping profile refreshes (Home/Profile both call refreshUser on focus). */
  const refreshingRef = React.useRef(false);
  /** Login already returned a fresh user — skip the immediate Home `/auth/me` bounce. */
  const skipNextProfileRefreshRef = React.useRef(false);

  React.useEffect(() => {
    warmUpServer();
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
      } catch {
        // ignore corrupt storage
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const signIn = React.useCallback(async (payload: { token: string; user: AuthUser }) => {
    skipNextProfileRefreshRef.current = true;
    setToken(payload.token);
    setUser(payload.user);
    await persistAuth(payload.token, payload.user);
    void upsertSavedLogin(payload.user);
  }, []);

  const refreshToken = React.useCallback(async (nextToken: string) => {
    setToken(nextToken);
    setUser((prev) => {
      if (!prev) return prev;
      void persistAuth(nextToken, prev);
      return prev;
    });
  }, []);

  const signOut = React.useCallback(async () => {
    clearReelPreviewCache();
    setToken(null);
    setUser(null);
    await persistAuth(null, null);
  }, []);

  const updateUser = React.useCallback(async (patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...patch };
      const t = tokenRef.current;
      if (t) {
        void persistAuth(t, merged);
      }
      return merged;
    });
  }, []);

  const refreshUser = React.useCallback(async () => {
    const t = tokenRef.current;
    if (!t || refreshingRef.current) return;
    if (skipNextProfileRefreshRef.current) {
      skipNextProfileRefreshRef.current = false;
      return;
    }
    refreshingRef.current = true;
    try {
      const data = await fetchMyAccount(t);
      if (!data?.user) return;
      await updateUser({
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName,
        role: data.user.role,
        phone: data.user.phone,
        username: data.user.username,
        avatarUrl: data.user.avatarUrl,
        bio: data.user.bio,
        website: data.user.website,
        locationLabel: data.user.locationLabel,
        accountStatus: data.user.accountStatus,
        isPrivate: data.user.isPrivate
      });
    } finally {
      refreshingRef.current = false;
    }
  }, [updateUser]);

  const value = React.useMemo<AuthState>(
    () => ({
      token,
      user,
      loading,
      signIn,
      refreshToken,
      refreshUser,
      signOut,
      updateUser
    }),
    [token, user, loading, signIn, refreshToken, refreshUser, signOut, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
