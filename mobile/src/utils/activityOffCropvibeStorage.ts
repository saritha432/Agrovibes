import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "agrovibes.activity-off-cropvibe";

export type ActivityOffCropvibeState = {
  recentApps: string[];
  futureActivityEnabled: boolean;
  disconnectedAppIds: string[];
  lastClearedAt: string | null;
};

export type PartnerActivityApp = {
  id: string;
  name: string;
};

export const DEFAULT_PARTNER_APPS: PartnerActivityApp[] = [
  { id: "travel-town", name: "Travel Town - Merge Adventure" },
  { id: "pokemon-go", name: "Pokémon GO" },
  { id: "farm-simulator", name: "Farm Simulator 24" }
];

const DEFAULT_STATE: ActivityOffCropvibeState = {
  recentApps: DEFAULT_PARTNER_APPS.map((app) => app.name),
  futureActivityEnabled: true,
  disconnectedAppIds: [],
  lastClearedAt: null
};

export async function readActivityOffCropvibeState(): Promise<ActivityOffCropvibeState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as ActivityOffCropvibeState;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      recentApps: Array.isArray(parsed.recentApps) ? parsed.recentApps : DEFAULT_STATE.recentApps,
      disconnectedAppIds: Array.isArray(parsed.disconnectedAppIds) ? parsed.disconnectedAppIds : []
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(state: ActivityOffCropvibeState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function clearPreviousActivity(): Promise<ActivityOffCropvibeState> {
  const state = await readActivityOffCropvibeState();
  const next = {
    ...state,
    recentApps: [],
    lastClearedAt: new Date().toISOString()
  };
  await writeState(next);
  return next;
}

export async function disconnectPartnerApp(appId: string): Promise<ActivityOffCropvibeState> {
  const state = await readActivityOffCropvibeState();
  const app = DEFAULT_PARTNER_APPS.find((item) => item.id === appId);
  const disconnectedAppIds = state.disconnectedAppIds.includes(appId)
    ? state.disconnectedAppIds
    : [...state.disconnectedAppIds, appId];
  const recentApps = app ? state.recentApps.filter((name) => name !== app.name) : state.recentApps;
  const next = { ...state, disconnectedAppIds, recentApps };
  await writeState(next);
  return next;
}

export async function setFutureActivityEnabled(enabled: boolean): Promise<ActivityOffCropvibeState> {
  const state = await readActivityOffCropvibeState();
  const next = { ...state, futureActivityEnabled: enabled };
  await writeState(next);
  return next;
}

export function activeRecentApps(state: ActivityOffCropvibeState): string[] {
  const disconnectedNames = new Set(
    DEFAULT_PARTNER_APPS.filter((app) => state.disconnectedAppIds.includes(app.id)).map((app) => app.name)
  );
  return state.recentApps.filter((name) => !disconnectedNames.has(name));
}

export function recentActivitySummary(state: ActivityOffCropvibeState): string {
  const apps = activeRecentApps(state);
  if (apps.length === 0) return "No recent off-cropvibe activity";
  if (apps.length === 1) return apps[0];
  if (apps.length === 2) return `${apps[0]} and ${apps[1]}`;
  return `${apps[0]}, ${apps[1]} and more`;
}
