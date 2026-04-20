import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export function AppTopBar() {
  return (
    <View style={styles.topBar}>
      <Image source={require("../../assets/crop vibe.png")} style={styles.logoImage} resizeMode="contain" />
      <View style={styles.rightSide}>
        <Pressable style={styles.iconBadge}>
          <Ionicons name="heart-outline" size={16} color="#1f2b28" />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>3</Text>
          </View>
        </Pressable>
        <Pressable style={styles.iconBadge}>
          <Ionicons name="radio-outline" size={16} color="#1f2b28" />
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
    justifyContent: "flex-center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingTop: 10
  },
  logoImage: { width: 112, height: 26 },
  rightSide: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto" },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff"
  },
  badge: {
    position: "absolute",
    right: -5,
    top: -4,
    backgroundColor: "#ef4444",
    borderRadius: 7,
    minWidth: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "700" }
});
