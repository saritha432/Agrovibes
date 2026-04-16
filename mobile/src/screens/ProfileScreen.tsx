import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppTopBar } from "../components/AppTopBar";

const profileBlocks = [
  "My Content",
  "My Listings",
  "My Orders",
  "Wallet",
  "Settings"
];

export function ProfileScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBottom}>
      <AppTopBar />
      <View style={styles.banner}>
        <View style={styles.avatar}><Text style={styles.avatarText}>RP</Text></View>
        <View style={styles.info}>
          <Text style={styles.name}>Ramesh Patel</Text>
          <Text style={styles.meta}>Nashik district</Text>
          <Text style={styles.kyc}>KYC: Phone yes | Aadhaar yes | Farmer yes</Text>
          <Text style={styles.reputation}>Reputation score: 4.8 / 5</Text>
        </View>
      </View>

      {profileBlocks.map((block) => (
        <View key={block} style={styles.block}>
          <View style={styles.blockRow}>
            <Text style={styles.blockTitle}>{block}</Text>
            <Ionicons name="chevron-forward" size={18} color="#6b7b77" />
          </View>
          <Text style={styles.blockText}>Structured section placeholder for {block.toLowerCase()}.</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  scrollBottom: { paddingBottom: 90 },
  banner: { margin: 12, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce4e1", padding: 12, flexDirection: "row", gap: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#e8f7ee", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#0a9f46", fontSize: 23, fontWeight: "700" },
  info: { flex: 1 },
  name: { fontSize: 22, fontWeight: "700", color: "#1b2523" },
  meta: { marginTop: 2, color: "#5b6965" },
  kyc: { marginTop: 6, color: "#0f7d3d", fontWeight: "700", fontSize: 12 },
  reputation: { marginTop: 3, color: "#6d551d", fontWeight: "600", fontSize: 12 },
  block: { marginHorizontal: 12, marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: "#dce4e1", backgroundColor: "#fff", padding: 12 },
  blockRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  blockTitle: { color: "#1d2825", fontWeight: "700", fontSize: 16 },
  blockText: { marginTop: 4, color: "#60706b" }
});
