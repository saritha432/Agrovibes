import AsyncStorage from "@react-native-async-storage/async-storage";

const MARKET_PREFIX = "agrovibes.market.cart.v1";
const RENTAL_PREFIX = "agrovibes.rental.cart.v1";
const LEGACY_RENTAL_KEY = "agrovibes.rental.cart.v1";

function cacheKey(prefix: string, userId?: number | null) {
  return userId ? `${prefix}.u${userId}` : `${prefix}.guest`;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export async function readMarketCartCache(userId?: number | null) {
  return readJson(cacheKey(MARKET_PREFIX, userId), [] as Array<Record<string, unknown>>);
}

export async function writeMarketCartCache(userId: number | null | undefined, items: unknown[]) {
  await AsyncStorage.setItem(cacheKey(MARKET_PREFIX, userId), JSON.stringify(items));
}

export async function readRentalCartCache(userId?: number | null) {
  const key = cacheKey(RENTAL_PREFIX, userId);
  const owned = await readJson(key, null as unknown[] | null);
  if (Array.isArray(owned)) return owned;
  if (userId) return [];
  const legacy = await readJson(LEGACY_RENTAL_KEY, [] as unknown[]);
  return Array.isArray(legacy) ? legacy : [];
}

export async function writeRentalCartCache(userId: number | null | undefined, items: unknown[]) {
  await AsyncStorage.setItem(cacheKey(RENTAL_PREFIX, userId), JSON.stringify(items));
  if (!userId) {
    await AsyncStorage.setItem(LEGACY_RENTAL_KEY, JSON.stringify(items));
  }
}

export async function clearGuestMarketCache() {
  await AsyncStorage.removeItem(cacheKey(MARKET_PREFIX, null));
}

export async function clearGuestRentalCache() {
  await AsyncStorage.multiRemove([cacheKey(RENTAL_PREFIX, null), LEGACY_RENTAL_KEY]);
}

export function mergeByKey<T>(
  local: T[],
  remote: T[],
  keyOf: (item: T) => string,
  qtyOf: (item: T) => number
): T[] {
  const map = new Map<string, T>();
  for (const item of remote) {
    const key = keyOf(item);
    if (key) map.set(key, item);
  }
  for (const item of local) {
    const key = keyOf(item);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || qtyOf(item) > qtyOf(existing)) map.set(key, item);
  }
  return [...map.values()];
}
