import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "../auth/AuthContext";

const STORAGE_KEY = "agrovibes.contacts-upload";

export type ProfileAccount = {
  id: string;
  displayName: string;
  subtitle: string;
  avatarUrl?: string | null;
};

export type ContactsUploadState = {
  syncEnabledByProfileId: string[];
};

export function buildProfileAccounts(user: AuthUser): ProfileAccount[] {
  const displayName = user.fullName || user.username || "Your profile";
  return [
    { id: "media", displayName, subtitle: "Media Account", avatarUrl: user.avatarUrl },
    { id: "business", displayName, subtitle: "Business Account", avatarUrl: user.avatarUrl },
    { id: "educator", displayName, subtitle: "Educator Account", avatarUrl: user.avatarUrl }
  ];
}

async function readState(): Promise<ContactsUploadState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { syncEnabledByProfileId: [] };
    const parsed = JSON.parse(raw) as ContactsUploadState;
    return {
      syncEnabledByProfileId: Array.isArray(parsed.syncEnabledByProfileId) ? parsed.syncEnabledByProfileId : []
    };
  } catch {
    return { syncEnabledByProfileId: [] };
  }
}

export async function isContactsSyncEnabled(profileId: string): Promise<boolean> {
  const state = await readState();
  return state.syncEnabledByProfileId.includes(profileId);
}

export async function toggleContactsSync(profileId: string): Promise<ContactsUploadState> {
  const state = await readState();
  const has = state.syncEnabledByProfileId.includes(profileId);
  const syncEnabledByProfileId = has
    ? state.syncEnabledByProfileId.filter((id) => id !== profileId)
    : [...state.syncEnabledByProfileId, profileId];
  const next = { syncEnabledByProfileId };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function readContactsUploadState(): Promise<ContactsUploadState> {
  return readState();
}
