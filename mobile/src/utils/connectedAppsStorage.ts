import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "../auth/AuthContext";

const STORAGE_KEY = "agrovibes.connected-apps";

export type ConnectedApp = {
  id: string;
  title: string;
  subtitle: string;
  icon: "mail-outline" | "calendar-outline";
  connected: boolean;
  category: "productivity";
};

const DEFAULT_APPS: ConnectedApp[] = [
  {
    id: "gmail",
    title: "Gmail",
    subtitle: "Agrovibemail@gmail.com",
    icon: "mail-outline",
    connected: false,
    category: "productivity"
  },
  {
    id: "farm-planner",
    title: "Farm Planner",
    subtitle: "farm planner",
    icon: "calendar-outline",
    connected: false,
    category: "productivity"
  }
];

export async function readConnectedApps(user: AuthUser | null): Promise<ConnectedApp[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ConnectedApp[]) : null;
    const base = Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_APPS;
    if (!user) return base;
    return base.map((app) =>
      app.id === "farm-planner"
        ? { ...app, title: user.fullName || user.username || "Farm Planner" }
        : app
    );
  } catch {
    return DEFAULT_APPS;
  }
}

export async function toggleConnectedApp(appId: string, user: AuthUser | null): Promise<ConnectedApp[]> {
  const apps = await readConnectedApps(user);
  const next = apps.map((app) => (app.id === appId ? { ...app, connected: !app.connected } : app));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
