/** True when the installed native binary includes ExpoImage (not just the JS package). */
export function hasExpoImageNative(): boolean {
  try {
    const optionalNative =
      require("expo-modules-core").requireOptionalNativeModule?.("ExpoImage") ?? null;
    return optionalNative != null;
  } catch {
    return false;
  }
}
