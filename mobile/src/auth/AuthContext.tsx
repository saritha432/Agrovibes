import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";

export type UserRole = "student" | "instructor" | "admin";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
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
}

const STORAGE_KEY = "agrovibes.auth";

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

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

  const signIn = React.useCallback(async (payload: { token: string; user: AuthUser }) => {
    setToken(payload.token);
    setUser(payload.user);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, []);

  const signOut = React.useCallback(async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const tokenRef = React.useRef<string | null>(null);
  tokenRef.current = token;

  const updateUser = React.useCallback(async (patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...patch };
      const t = tokenRef.current;
      if (t) {
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ token: t, user: merged })).catch(() => {});
      }
      return merged;
    });
  }, []);

  const value: AuthState = { token, user, loading, signIn, signOut, updateUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

