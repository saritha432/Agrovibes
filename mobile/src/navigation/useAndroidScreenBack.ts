import { useCallback } from "react";
import { BackHandler, Platform } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { registerFocusedScreenBack } from "./focusedScreenBackBridge";
import { navigateToHome } from "./navigationRef";

/**
 * Register focused-screen back with BOTH:
 * 1) focusedScreenBackBridge (used by the global handler for overlays-first order)
 * 2) a direct BackHandler (LIFO) so this screen's goBack runs even if global misses
 *
 * Uses the screen's own navigation object — same path as in-app back buttons.
 */
export function useAndroidScreenBack(onBack: () => boolean) {
  useFocusEffect(
    useCallback(() => {
      const unregister = registerFocusedScreenBack(onBack);
      if (Platform.OS !== "android") return unregister;

      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => {
        sub.remove();
        unregister();
      };
    }, [onBack])
  );
}

/** Bottom tab (non-Home): hardware back returns to Home instead of exiting the app. */
export function useAndroidTabBackToHome() {
  useAndroidScreenBack(
    useCallback(() => {
      navigateToHome();
      return true;
    }, [])
  );
}

/** Nested stack screen: hardware back pops the stack. */
export function useAndroidNestedStackBack() {
  const navigation = useNavigation();
  useAndroidScreenBack(
    useCallback(() => {
      navigation.goBack();
      return true;
    }, [navigation])
  );
}
