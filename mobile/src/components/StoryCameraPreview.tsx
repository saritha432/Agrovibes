import React, { forwardRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  facing?: "front" | "back";
  active?: boolean;
  mode?: "picture" | "video";
  onPress?: () => void;
};

/** Web: tap opens full-screen browser camera. */
export const StoryCameraPreview = forwardRef<unknown, Props>(function StoryCameraPreview({ onPress }, _ref) {
  if (Platform.OS !== "web") return null;
  return (
    <Pressable style={styles.fallback} onPress={onPress}>
      <Ionicons name="camera-outline" size={42} color="rgba(255,255,255,0.65)" />
      <Text style={styles.hint}>Tap for live camera</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2e2e2e",
    gap: 8
  },
  hint: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "600" }
});
