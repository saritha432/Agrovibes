import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function AppTopBar() {
  return (
    <View style={styles.topBar}>
      <View style={styles.leftSide}>
        <View style={styles.selectorChip}>
          <Ionicons name="location-outline" size={13} color="#1f2b28" />
          <Text style={styles.selectorText}>Nashik</Text>
        </View>
        <View style={styles.selectorChip}>
          <Ionicons name="language-outline" size={13} color="#1f2b28" />
          <Text style={styles.selectorText}>Auto EN</Text>
        </View>
      </View>
      <View style={styles.rightSide}>
        <Pressable style={styles.iconBadge}>
          <Ionicons name="notifications-outline" size={16} color="#0f7d3d" />
          <View style={styles.badge}><Text style={styles.badgeText}>3</Text></View>
        </Pressable>
        <View style={styles.walletChip}>
          <Ionicons name="wallet-outline" size={14} color="#0f7d3d" />
          <View>
            <Text style={styles.walletText}>Bal Rs 12.4k</Text>
            <Text style={styles.walletSub}>Escrow Rs 2.1k</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e3e7e6",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  leftSide: { flexDirection: "row", gap: 6, flex: 1 },
  selectorChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f2f5f4",
    borderWidth: 1,
    borderColor: "#d7dfdc",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  selectorText: { fontSize: 12, color: "#273230", fontWeight: "600" },
  rightSide: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef8f1",
    borderWidth: 1,
    borderColor: "#cde9d9"
  },
  badge: {
    position: "absolute",
    right: -3,
    top: -4,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  walletChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#eef8f1",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10
  },
  walletText: { fontSize: 11, color: "#0f7d3d", fontWeight: "700" },
  walletSub: { fontSize: 10, color: "#3e8f63", fontWeight: "600" }
});
