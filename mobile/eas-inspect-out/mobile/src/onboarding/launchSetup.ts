import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "agrovibes.launch-setup.v1";

export async function isLaunchSetupComplete(userId: number | string) {
  const key = `${PREFIX}.done.${String(userId)}`;
  return (await AsyncStorage.getItem(key)) === "1";
}

export async function markLaunchSetupComplete(userId: number | string) {
  const key = `${PREFIX}.done.${String(userId)}`;
  await AsyncStorage.setItem(key, "1");
}

export async function setLaunchLanguage(userId: number | string, language: string) {
  const key = `${PREFIX}.language.${String(userId)}`;
  await AsyncStorage.setItem(key, language.trim());
}
