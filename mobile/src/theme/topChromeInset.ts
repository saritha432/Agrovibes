import { useMemo } from "react";
import { Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Small gap below status icons for fullscreen modal controls (stories, reels). */
export const MODAL_TOP_CHROME_GAP = 4;

/** Gap below status icons for floating close buttons on fullscreen media. */
export const FLOATING_TOP_CHROME_GAP = 8;

/**
 * Instagram-style top inset: one status-bar offset for headers on every device/build.
 * Use safe-area when available; fall back to StatusBar height only when insets report 0 (dev client).
 * Never stack Math.max(insets, StatusBar) — that caused extra padding on preview/release APKs.
 */
export function resolveTopChromeInset(insetsTop: number): number {
  if (Platform.OS === "web") return 0;
  if (Platform.OS === "ios") return insetsTop;
  const statusBar = StatusBar.currentHeight ?? 0;
  if (insetsTop > 0) return insetsTop;
  return statusBar > 0 ? statusBar : 24;
}

export function useTopChromeInset(): number {
  const insets = useSafeAreaInsets();
  return useMemo(() => resolveTopChromeInset(insets.top), [insets.top]);
}

/** Story / reel / fullscreen viewer top chrome — same inset + small control gap. */
export function useModalTopChromeInset(): number {
  const top = useTopChromeInset();
  return useMemo(() => top + (Platform.OS === "web" ? 0 : MODAL_TOP_CHROME_GAP), [top]);
}

/** Floating X / back on edge-to-edge fullscreen media viewers. */
export function useFloatingTopChromeInset(gap = FLOATING_TOP_CHROME_GAP): number {
  const top = useTopChromeInset();
  return useMemo(() => top + (Platform.OS === "web" ? 0 : gap), [gap, top]);
}
