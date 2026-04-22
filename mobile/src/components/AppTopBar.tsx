import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export function AppTopBar() {
  return (
    <View style={styles.topBar}>
      <Image source={require("../../assets/crop vibe.png")} style={styles.logoImage} resizeMode="contain" />
      <View style={styles.rightSide}>
        <Pressable style={styles.iconBadge}>
          <Ionicons name="notifications-outline" size={16} color="#d8ff37" />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>1</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "#262626",
    paddingHorizontal: 10,
    paddingVertical: 7,
    paddingTop: 10
  },
  logoImage: { width: 86, height: 20 },
  rightSide: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto" },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  badge: {
    position: "absolute",
    right: -5,
    top: -4,
    backgroundColor: "#d8ff37",
    borderRadius: 7,
    minWidth: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: { color: "#1f2b28", fontSize: 8, fontWeight: "700" }
});
