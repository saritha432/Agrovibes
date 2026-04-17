import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function AppTopBar() {
  return (
    <View style={styles.topBar}>
      <View style={styles.leftSide}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={12} color="#8c5f2c" />
        </View>
        <View>
          <Text style={styles.userName}>Nashik, MH</Text>
          <Text style={styles.userSub}>Farmer</Text>
        </View>
      </View>
      <View style={styles.rightSide}>
        <Pressable style={styles.iconBtn}>
          <Ionicons name="search-outline" size={16} color="#1f2b28" />
        </Pressable>
        <Pressable style={styles.iconBadge}>
          <Ionicons name="notifications-outline" size={16} color="#1f2b28" />
          <View style={styles.badge}><Text style={styles.badgeText}>1</Text></View>
        </Pressable>
        <Pressable style={styles.iconBtn}>
          <Ionicons name="help-circle-outline" size={16} color="#1f2b28" />
        </Pressable>
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
    borderBottomColor: "#ece7e1",
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingTop: 10
  },
  leftSide: { flexDirection: "row", gap: 7, flex: 1, alignItems: "center" },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#f5d8bd",
    alignItems: "center",
    justifyContent: "center"
  },
  userName: { fontSize: 10, color: "#273230", fontWeight: "700" },
  userSub: { fontSize: 9, color: "#87938f", fontWeight: "500", marginTop: 1 },
  rightSide: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
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
