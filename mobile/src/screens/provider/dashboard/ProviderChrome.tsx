import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_LIME, APP_TEXT_MUTED } from "../../../theme/appColors";

const BG = "#262626";
const SCREEN_BG = "#303132";
const CROP_VIBE_MARK = require("../../../../assets/crop vibe.png");

export function ProviderChromeHeader({
  onBellPress
}: {
  onBellPress?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.bar}>
        <Image source={CROP_VIBE_MARK} style={styles.brand} resizeMode="contain" accessibilityLabel="CropVibe" />
        <Pressable
          style={styles.bellBtn}
          onPress={onBellPress}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          hitSlop={10}
        >
          <Ionicons name="notifications-outline" size={22} color={APP_LIME} />
        </Pressable>
      </View>
    </View>
  );
}

export function ProviderEmptyState({
  title,
  subtitle
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    backgroundColor: BG,
    borderWidth: 0,
    borderBottomWidth: 0
  },
  bar: {
    height: 55,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingRight: 16,
    paddingBottom: 12,
    paddingLeft: 16
  },
  brand: {
    width: 132,
    height: 28,
    maxWidth: "46%"
  },
  bellBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: SCREEN_BG,
    paddingBottom: 100
  },
  emptyTitle: {
    color: APP_LIME,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center"
  },
  emptySub: {
    marginTop: 8,
    color: APP_TEXT_MUTED,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18
  }
});
