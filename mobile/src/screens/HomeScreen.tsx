import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppTopBar } from "../components/AppTopBar";

export function HomeScreen() {
  return (
    <View style={styles.screen}>
      <AppTopBar />
      <View style={styles.searchWrap}>
        <TextInput placeholder="Search crops, farmers, districts..." style={styles.searchInput} />
        <Pressable style={styles.voiceButton}>
          <Text style={styles.voiceButtonText}>🎤</Text>
        </Pressable>
      </View>
      <View style={styles.reelHero}>
        <Text style={styles.reelPlay}>▶</Text>
        <Text style={styles.reelTitle}>Tomato</Text>
        <Text style={styles.reelMeta}>Rabi Season</Text>
        <View style={styles.heroActions}>
          <Pressable style={styles.buyNow}>
            <Text style={styles.buyNowText}>Buy Now</Text>
          </Pressable>
          <Pressable style={styles.explore}>
            <Text style={styles.exploreText}>Explore Market</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  searchWrap: { margin: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, backgroundColor: "#f2f0eb", borderRadius: 10, borderWidth: 1, borderColor: "#e4e6df", paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  voiceButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#0a9f46", alignItems: "center", justifyContent: "center" },
  voiceButtonText: { color: "#fff", fontSize: 16 },
  reelHero: { marginHorizontal: 12, borderRadius: 16, minHeight: 260, backgroundColor: "#07803a", alignItems: "center", justifyContent: "center", paddingBottom: 16 },
  reelPlay: { color: "#fff", fontSize: 28, opacity: 0.9 },
  reelTitle: { color: "#fff", fontSize: 34, fontWeight: "700", marginTop: 12 },
  reelMeta: { color: "#d6f0dd", marginTop: 5, fontWeight: "600" },
  heroActions: { position: "absolute", right: 10, top: 12, gap: 10, alignItems: "flex-end" },
  buyNow: { backgroundColor: "#f2ae00", paddingHorizontal: 13, paddingVertical: 6, borderRadius: 18 },
  buyNowText: { color: "#1f2524", fontWeight: "700", fontSize: 12 },
  explore: { backgroundColor: "#0a9f46", paddingHorizontal: 13, paddingVertical: 7, borderRadius: 18 },
  exploreText: { color: "#fff", fontWeight: "700", fontSize: 12 }
});
