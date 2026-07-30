import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import * as Updates from "expo-updates";
import { Ionicons } from "@expo/vector-icons";
import { APP_BLACK, APP_LIME, APP_TEXT_MUTED } from "../theme/appColors";

type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "downloading" }
  | { status: "ready" }
  | { status: "error"; message: string };

function useOtaUpdate() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const checkedRef = useRef(false);

  const checkAndFetch = useCallback(async () => {
    if (Updates.isEmbeddedLaunch) return; // dev / emulator — skip
    if (checkedRef.current) return;
    checkedRef.current = true;

    try {
      setState({ status: "checking" });
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setState({ status: "idle" });
        return;
      }
      setState({ status: "available" });
    } catch {
      setState({ status: "idle" });
    }
  }, []);

  const downloadAndReload = useCallback(async () => {
    try {
      setState({ status: "downloading" });
      await Updates.fetchUpdateAsync();
      setState({ status: "ready" });
      await Updates.reloadAsync();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Update failed. Please try again.";
      setState({ status: "error", message });
    }
  }, []);

  const dismiss = useCallback(() => setState({ status: "idle" }), []);

  return { state, checkAndFetch, downloadAndReload, dismiss };
}

export function OtaUpdateBanner() {
  const { state, checkAndFetch, downloadAndReload, dismiss } = useOtaUpdate();
  const slideY = useRef(new Animated.Value(-80)).current;
  const visible =
    state.status === "available" ||
    state.status === "downloading" ||
    state.status === "ready" ||
    state.status === "error";

  useEffect(() => {
    // Check once a few seconds after app opens so the UI is ready first.
    const timer = setTimeout(() => {
      void checkAndFetch();
    }, 3500);
    return () => clearTimeout(timer);
  }, [checkAndFetch]);

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : -80,
      useNativeDriver: true,
      bounciness: 4,
      speed: 14
    }).start();
  }, [visible, slideY]);

  if (!visible) return null;

  const isDownloading = state.status === "downloading";
  const isError = state.status === "error";

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY: slideY }] }]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={isError ? "warning-outline" : "cloud-download-outline"}
            size={22}
            color={isError ? "#ff6b6b" : APP_LIME}
          />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>
            {isError ? "Update failed" : "Update available"}
          </Text>
          <Text style={styles.subtitle}>
            {isError
              ? (state as { status: "error"; message: string }).message
              : isDownloading
                ? "Downloading… please wait"
                : "A new version of Cropvibe is ready."}
          </Text>
        </View>

        {!isError && !isDownloading ? (
          <Pressable
            style={styles.updateBtn}
            onPress={downloadAndReload}
            accessibilityRole="button"
            accessibilityLabel="Update now"
          >
            <Text style={styles.updateBtnText}>Update</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={styles.closeBtn}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss update banner"
        >
          <Ionicons name="close" size={18} color={APP_TEXT_MUTED} />
        </Pressable>
      </View>

      {isDownloading ? (
        <View style={styles.progressTrack}>
          <Animated.View style={styles.progressFill} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 36,
    left: 12,
    right: 12,
    backgroundColor: "#1c1e20",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    zIndex: 9999
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(201,255,53,0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  textWrap: { flex: 1 },
  title: {
    color: "#f0f4f8",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18
  },
  subtitle: {
    color: APP_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2
  },
  updateBtn: {
    backgroundColor: APP_LIME,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7
  },
  updateBtnText: {
    color: APP_BLACK,
    fontSize: 13,
    fontWeight: "800"
  },
  closeBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center"
  },
  progressTrack: {
    marginTop: 10,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 2,
    overflow: "hidden"
  },
  progressFill: {
    height: 3,
    width: "60%",
    backgroundColor: APP_LIME,
    borderRadius: 2
  }
});
