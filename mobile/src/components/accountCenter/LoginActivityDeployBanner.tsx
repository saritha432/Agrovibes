import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LOGIN_ACTIVITY_DEPLOY_HINT } from "../../utils/loginActivityFallback";
import { APP_LIME, APP_SURFACE, APP_TEXT_MUTED } from "../../theme/appColors";

export function LoginActivityDeployBanner({ visible }: { visible?: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.banner}>
      <Ionicons name="information-circle-outline" size={18} color={APP_LIME} />
      <Text style={styles.text}>{LOGIN_ACTIVITY_DEPLOY_HINT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: APP_SURFACE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16
  },
  text: {
    flex: 1,
    color: APP_TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18
  }
});
