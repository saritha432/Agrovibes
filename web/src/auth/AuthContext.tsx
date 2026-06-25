import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { fetchAuthMe } from "../api/auth";
import type { AuthUser } from "../api/types";
import { connectSocketChat, disconnectSocketChat } from "../services/socketChat";

const STORAGE_KEY = "cropvibe.web.auth";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  signIn: (payload: { token: string; user: AuthUser }) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { token?: string; user?: AuthUser };
        if (!parsed.token || !parsed.user) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        try {
          const me = await fetchAuthMe(parsed.token);
          if (cancelled) return;
          setToken(parsed.token);
          setUser(me.user);
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: parsed.token, user: me.user }));
          connectSocketChat(parsed.token);
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((payload: { token: string; user: AuthUser }) => {
    setToken(payload.token);
    setUser(payload.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    connectSocketChat(payload.token);
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { token?: string; user?: AuthUser };
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, user: next }));
        }
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const signOut = useCallback(() => {
    disconnectSocketChat();
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ token, user, loading, signIn, updateUser, signOut }),
    [token, user, loading, signIn, updateUser, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
