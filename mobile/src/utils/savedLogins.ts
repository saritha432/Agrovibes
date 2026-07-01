import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "../auth/AuthContext";
import { roleAccountLabel } from "./loginActivityFormatters";

const STORAGE_KEY = "agrovibes.saved-logins";

export type SavedLoginAccount = {
  userId: number;
  displayName: string;
  accountType: string;
  avatarUrl?: string | null;
  role?: string;
  lastUsedAt: string;
};

export async function readSavedLogins(): Promise<SavedLoginAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedLoginAccount[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.userId === "number")
      .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());
  } catch {
    return [];
  }
}

export async function upsertSavedLogin(user: AuthUser): Promise<void> {
  const displayName = user.fullName || user.username || "Your profile";
  const entry: SavedLoginAccount = {
    userId: user.id,
    displayName,
    accountType: roleAccountLabel(user.role),
    avatarUrl: user.avatarUrl,
    role: user.role,
    lastUsedAt: new Date().toISOString()
  };
  const existing = await readSavedLogins();
  const next = [entry, ...existing.filter((item) => item.userId !== user.id)];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
