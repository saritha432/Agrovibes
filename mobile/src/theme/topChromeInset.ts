import { useMemo } from "react";
import { Platform, StatusBar, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Small gap below status icons for fullscreen modal controls (stories, reels). */
export const MODAL_TOP_CHROME_GAP = 4;

/** Gap below status icons for floating close buttons on fullscreen media. */
export const FLOATING_TOP_CHROME_GAP = 8;

const ANDROID_TOP_INSET_MAX = 36;
const COMPACT_SCREEN_HEIGHT = 700;
const COMPACT_TOP_INSET_MAX = 26;

/**
 * Instagram-style top inset: one status-bar offset for headers on every device/build.
 *
 * Android: prefer the smaller of StatusBar.currentHeight and safe-area top when both
 * exist — avoids double top gap on dev clients / compact devices. Cap inflated OEM values.
 *
 * iOS: use safe-area (notch / Dynamic Island).
 */
export function resolveTopChromeInset(insetsTop: number, windowHeight = 0): number {
  if (Platform.OS === "web") return 0;
  if (Platform.OS === "ios") return insetsTop;

  const statusBar = Number(StatusBar.currentHeight ?? 0);

  let inset = 0;
  if (statusBar > 0 && insetsTop > 0) {
    inset = Math.min(statusBar, insetsTop);
  } else if (statusBar > 0) {
    inset = statusBar;
  } else if (insetsTop > 0) {
    inset = insetsTop;
  } else {
    inset = 24;
  }

  let capped = Math.min(Math.max(inset, 0), ANDROID_TOP_INSET_MAX);

  if (windowHeight > 0 && windowHeight < COMPACT_SCREEN_HEIGHT) {
    capped = Math.min(capped, COMPACT_TOP_INSET_MAX);
  }

  return capped;
}

export function useTopChromeInset(): number {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return useMemo(() => resolveTopChromeInset(insets.top, height), [height, insets.top]);
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
