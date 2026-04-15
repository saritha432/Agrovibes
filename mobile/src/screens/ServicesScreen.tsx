import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppTopBar } from "../components/AppTopBar";

export function ServicesScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBottom}>
      <AppTopBar />
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Services</Text>
        <Text style={styles.sectionSub}>Machinery · Logistics · Expert Consultation · Weather</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {["All", "Tractor", "Harvester", "Irrigation", "Other"].map((chip, index) => (
          <View key={chip} style={[styles.filterChip, index === 0 ? styles.activeChip : null]}>
            <Text style={[styles.filterChipText, index === 0 ? styles.activeChipText : null]}>{chip}</Text>
          </View>
        ))}
      </ScrollView>
      {[1, 2].map((item) => (
        <View key={item} style={styles.serviceCard}>
          <View style={styles.serviceMedia}>
            <Text style={styles.serviceMediaText}>🚜</Text>
            <View style={styles.availableBadge}>
              <Text style={styles.availableText}>Available</Text>
            </View>
          </View>
          <View style={styles.serviceBody}>
            <Text style={styles.serviceName}>{item === 1 ? "Mahindra 575 DI" : "Sonalika GT 750 RX"}</Text>
            <Text style={styles.serviceMeta}>📍 Punjab</Text>
            <Text style={styles.servicePrice}>₹1800/day</Text>
            <Pressable style={styles.bookButton}>
              <Text style={styles.bookText}>Book Now</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  scrollBottom: { paddingBottom: 90 },
  sectionHeader: { paddingHorizontal: 12, paddingVertical: 10 },
  sectionTitle: { fontSize: 32, fontWeight: "700", color: "#121716" },
  sectionSub: { color: "#4b5a56", marginTop: 3, fontWeight: "500" },
  chipRow: { paddingHorizontal: 10, gap: 8, alignItems: "center" },
  filterChip: { borderRadius: 18, borderWidth: 1, borderColor: "#c4d3cc", backgroundColor: "#f7fbf9", paddingHorizontal: 14, paddingVertical: 9 },
  activeChip: { backgroundColor: "#0a9f46", borderColor: "#0a9f46" },
  filterChipText: { color: "#2b3634", fontWeight: "600" },
  activeChipText: { color: "#fff" },
  serviceCard: { backgroundColor: "#fff", borderRadius: 14, marginHorizontal: 12, marginTop: 10, overflow: "hidden", borderWidth: 1, borderColor: "#d8e2de" },
  serviceMedia: { minHeight: 120, backgroundColor: "#ff5f42", alignItems: "center", justifyContent: "center" },
  serviceMediaText: { fontSize: 36, color: "#fff" },
  availableBadge: { position: "absolute", right: 8, top: 8, backgroundColor: "#3bbf6d", borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4 },
  availableText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  serviceBody: { padding: 12 },
  serviceName: { fontSize: 18, fontWeight: "700", color: "#1e2926" },
  serviceMeta: { marginTop: 4, color: "#5a6865" },
  servicePrice: { marginTop: 8, color: "#0a9f46", fontSize: 25, fontWeight: "700" },
  bookButton: { marginTop: 10, borderWidth: 1.5, borderColor: "#0a9f46", borderRadius: 10, alignItems: "center", paddingVertical: 10 },
  bookText: { color: "#0a9f46", fontWeight: "700" }
});
