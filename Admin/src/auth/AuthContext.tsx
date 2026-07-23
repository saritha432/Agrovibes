import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AdminUser = {
  id: number;
  email: string;
  fullName: string;
  role: string;
};

type AuthState = {
  token: string | null;
  user: AdminUser | null;
  loading: boolean;
  signIn: (payload: { token: string; user: AdminUser }) => void;
  signOut: () => void;
};

const STORAGE_KEY = "cropvibe_admin_auth";

const AuthContext = createContext<AuthState | null>(null);

function readStored(): { token: string; user: AdminUser } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; user?: AdminUser };
    if (!parsed?.token || !parsed?.user) return null;
    return { token: parsed.token, user: parsed.user };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = readStored();
  const [token, setToken] = useState<string | null>(stored?.token ?? null);
  const [user, setUser] = useState<AdminUser | null>(stored?.user ?? null);

  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      loading: false,
      signIn: ({ token: nextToken, user: nextUser }) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
        setToken(nextToken);
        setUser(nextUser);
      },
      signOut: () => {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
      }
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
