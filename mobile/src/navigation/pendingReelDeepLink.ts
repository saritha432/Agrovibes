import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "agrovibes.pendingReelDeepLink";

export async function persistPendingReelDeepLink(postId: number) {
  if (!Number.isFinite(postId) || postId <= 0) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(postId));
  } catch {
    // no-op
  }
}

export async function takePersistedReelDeepLink(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(STORAGE_KEY);
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) return null;
    return id;
  } catch {
    return null;
  }
}
