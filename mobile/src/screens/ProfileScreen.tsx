import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppTopBar } from "../components/AppTopBar";

export function ProfileScreen() {
  const colors = ["#d95f74", "#be497d", "#ce9a1f", "#4e9fcf", "#28a064", "#7e67cc"];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBottom}>
      <AppTopBar />
      <View style={styles.profileBanner}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>RP</Text>
        </View>
        <View>
          <Text style={styles.profileName}>Ramesh Patel</Text>
          <Text style={styles.profileMeta}>Nashik, Maharashtra</Text>
          <Text style={styles.sellerBadge}>⭐ 4.8 Trusted Seller</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        {["Top Seller", "100+ Crops", "4.8 Rating", "500+ Followers"].map((item) => (
          <View key={item} style={styles.statChip}>
            <Text style={styles.statChipText}>{item}</Text>
          </View>
        ))}
      </View>
      <View style={styles.tabsRow}>
        {["Content", "Listings", "Orders", "Wallet"].map((item, index) => (
          <Text key={item} style={[styles.profileTab, index === 0 ? styles.profileTabActive : null]}>
            {item}
          </Text>
        ))}
      </View>
      <Text style={styles.videoTitle}>My Videos</Text>
      <View style={styles.videoGrid}>
        {colors.map((color) => (
          <View key={color} style={[styles.videoCard, { backgroundColor: color }]}>
            <Text style={styles.videoCount}>◉ 8.9k</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  scrollBottom: { paddingBottom: 90 },
  profileBanner: { margin: 12, borderRadius: 14, backgroundColor: "#ffffff", padding: 12, flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderColor: "#dce4e1" },
  profileAvatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#e8f7ee", alignItems: "center", justifyContent: "center" },
  profileAvatarText: { color: "#0a9f46", fontSize: 27, fontWeight: "700" },
  profileName: { fontSize: 29, fontWeight: "700", color: "#1b2523" },
  profileMeta: { marginTop: 4, color: "#5b6965" },
  sellerBadge: { marginTop: 5, color: "#c68400", fontWeight: "700" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12 },
  statChip: { borderWidth: 1, borderColor: "#f0d494", backgroundColor: "#fff7e6", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  statChipText: { color: "#b37300", fontWeight: "700", fontSize: 12 },
  tabsRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e6e3",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e6e3",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff"
  },
  profileTab: { color: "#667572", fontWeight: "600" },
  profileTabActive: { color: "#0a9f46", fontWeight: "700" },
  videoTitle: { marginTop: 10, marginHorizontal: 12, fontSize: 24, fontWeight: "700", color: "#121716" },
  videoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 },
  videoCard: { width: "31%", borderRadius: 12, minHeight: 110, justifyContent: "flex-end", padding: 10 },
  videoCount: { color: "#fff", fontWeight: "700" }
});
