import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppTopBar } from "../components/AppTopBar";

const cards = [
  { key: "machinery", title: "Machinery Booking", desc: "Filter, schedule, 30% advance escrow, completion release.", icon: "construct-outline" },
  { key: "logistics", title: "Logistics Booking", desc: "Pickup, estimate, GPS tracking, escrow auto release.", icon: "car-outline" },
  { key: "expert", title: "Expert Consultation", desc: "Browse experts, slots, call summary, optional rating.", icon: "medkit-outline" },
  { key: "weather", title: "Weather and Advisory", desc: "Quick weather view and AI pest alert feed.", icon: "partly-sunny-outline" }
];

export function ServicesScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBottom}>
      <AppTopBar />
      <View style={styles.header}><Text style={styles.title}>Services</Text><Text style={styles.sub}>Machinery, logistics, experts and advisories</Text></View>
      {cards.map((item) => (
        <View key={item.key} style={styles.card}>
          <View style={styles.iconWrap}><Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={20} color="#0a9f46" /></View>
          <View style={styles.body}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>
            <Pressable style={styles.cta}><Text style={styles.ctaText}>Open</Text></Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  scrollBottom: { paddingBottom: 100 },
  header: { padding: 12 },
  title: { fontSize: 30, fontWeight: "700", color: "#121716" },
  sub: { color: "#4b5a56", marginTop: 3, fontWeight: "500" },
  card: { marginHorizontal: 12, marginTop: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce3e1", borderRadius: 14, padding: 12, flexDirection: "row", gap: 10 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#e8f5ee", alignItems: "center", justifyContent: "center", marginTop: 2 },
  body: { flex: 1 },
  cardTitle: { color: "#1e2926", fontWeight: "700", fontSize: 18 },
  cardDesc: { marginTop: 4, color: "#5a6865", lineHeight: 20 },
  cta: { marginTop: 8, alignSelf: "flex-start", borderRadius: 10, borderWidth: 1, borderColor: "#0a9f46", paddingHorizontal: 12, paddingVertical: 8 },
  ctaText: { color: "#0a9f46", fontWeight: "700" }
});
