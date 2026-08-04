import React, { useMemo } from "react";
import { Platform } from "react-native";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  useSafeAreaFrame,
  useSafeAreaInsets,
  type EdgeInsets
} from "react-native-safe-area-context";
import { resolveTopChromeInset } from "../theme/topChromeInset";

/**
 * Re-provide safe-area insets with a reliable iOS top clearance.
 * Native metrics sometimes report top=0 (boot race / some builds), which draws under the status bar.
 */
export function EnsureIosSafeAreaInsets({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();

  const fixedInsets = useMemo<EdgeInsets>(() => {
    if (Platform.OS !== "ios") return insets;
    const top = resolveTopChromeInset(insets.top, frame.height);
    let bottom = insets.bottom;
    // Notch / Dynamic Island devices should expose a home-indicator inset.
    if (top >= 44 && bottom < 8) {
      bottom = 34;
    }
    if (top === insets.top && bottom === insets.bottom) return insets;
    return { ...insets, top, bottom };
  }, [frame.height, insets]);

  return (
    <SafeAreaFrameContext.Provider value={frame}>
      <SafeAreaInsetsContext.Provider value={fixedInsets}>{children}</SafeAreaInsetsContext.Provider>
    </SafeAreaFrameContext.Provider>
  );
}
