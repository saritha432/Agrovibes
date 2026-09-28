import AsyncStorage from "@react-native-async-storage/async-storage";

const MY_SCHEMES_KEY = "cropvibe.myGovSchemes";

export async function readSavedSchemeIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(MY_SCHEMES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export async function writeSavedSchemeIds(ids: string[]) {
  await AsyncStorage.setItem(MY_SCHEMES_KEY, JSON.stringify(ids));
}
