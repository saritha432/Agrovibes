import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function AppTopBar() {
  return (
    <View style={styles.topBar}>
      <View style={styles.brandChip}>
        <Text style={styles.brandLogo}>◍</Text>
      </View>
      <View style={styles.selectorRow}>
        <View style={styles.selectorChip}>
          <Text style={styles.selectorText}>📍 Nashik</Text>
        </View>
        <View style={styles.selectorChip}>
          <Text style={styles.selectorText}>GB EN ⌄</Text>
        </View>
      </View>
      <View style={styles.walletChip}>
        <Text style={styles.walletText}>🔔 3</Text>
        <Text style={styles.walletText}>₹12.4K</Text>
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
    paddingVertical: 9
  },
  brandChip: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#0a9f46", alignItems: "center", justifyContent: "center" },
  brandLogo: { color: "#fff", fontWeight: "700" },
  selectorRow: { flexDirection: "row", gap: 6 },
  selectorChip: { backgroundColor: "#f2f5f4", borderWidth: 1, borderColor: "#d7dfdc", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  selectorText: { fontSize: 12, color: "#273230", fontWeight: "600" },
  walletChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#eef8f1", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  walletText: { fontSize: 12, color: "#0f7d3d", fontWeight: "700" }
});
