import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_KEY = "agrovibes.search-history-settings";
export const RECENT_SEARCHES_STORAGE_KEY = "discover.recentSearches.v1";
export const RECENT_USERS_STORAGE_KEY = "discover.recentUsers.v1";

export type AutoClearPeriod = 3 | 7 | 14 | 30 | "default";

export type SearchHistorySettings = {
  autoClearPeriod: AutoClearPeriod;
  lastClearedAt: string | null;
};

const DEFAULT_SETTINGS: SearchHistorySettings = {
  autoClearPeriod: "default",
  lastClearedAt: null
};

export function autoClearPeriodLabel(period: AutoClearPeriod): string {
  if (period === "default") return "Default";
  return `${period} days`;
}

export async function readSearchHistorySettings(): Promise<SearchHistorySettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as SearchHistorySettings;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      autoClearPeriod: parsed.autoClearPeriod || "default"
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function setAutoClearPeriod(period: AutoClearPeriod): Promise<SearchHistorySettings> {
  const current = await readSearchHistorySettings();
  const next = { ...current, autoClearPeriod: period };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export async function clearStoredSearches(): Promise<void> {
  await AsyncStorage.multiRemove([RECENT_SEARCHES_STORAGE_KEY, RECENT_USERS_STORAGE_KEY]);
  const current = await readSearchHistorySettings();
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ ...current, lastClearedAt: new Date().toISOString() })
  );
}

export async function pruneExpiredSearches(): Promise<void> {
  const { autoClearPeriod } = await readSearchHistorySettings();
  if (autoClearPeriod === "default") return;

  const raw = await AsyncStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as Array<{ query?: string; at?: string } | string>;
    if (!Array.isArray(parsed)) return;

    const cutoff = Date.now() - autoClearPeriod * 24 * 60 * 60 * 1000;
    const next = parsed.filter((item) => {
      if (typeof item === "string") return true;
      const at = item?.at ? new Date(item.at).getTime() : NaN;
      return !Number.isFinite(at) || at >= cutoff;
    });

    if (next.length !== parsed.length) {
      await AsyncStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore malformed cache
  }
}
