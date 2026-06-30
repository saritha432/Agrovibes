import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { LoginSessionPlatform } from "../../services/api";
import { APP_LIME } from "../../theme/appColors";

function platformIcon(platform: LoginSessionPlatform): keyof typeof Ionicons.glyphMap {
  if (platform === "ios") return "logo-apple";
  if (platform === "windows") return "logo-windows";
  if (platform === "web") return "globe-outline";
  return "logo-android";
}

export function LoginDeviceIcon({ platform }: { platform: LoginSessionPlatform }) {
  return (
    <View style={styles.deviceIconWrap}>
      <Ionicons name={platformIcon(platform)} size={22} color={APP_LIME} />
    </View>
  );
}

const styles = StyleSheet.create({
  deviceIconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  }
});
