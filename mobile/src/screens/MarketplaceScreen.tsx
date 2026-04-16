import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppTopBar } from "../components/AppTopBar";
import { fetchMarketplaceListings, MarketplaceListing } from "../services/api";

const filterChips = ["Category", "District", "Verified only", "Price range", "Availability"];

export function MarketplaceScreen() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");

  useEffect(() => {
    let mounted = true;
    fetchMarketplaceListings()
      .then((data) => {
        if (mounted) setListings(data.listings);
      })
      .catch(() => {
        if (!mounted) return;
        setErrorMessage("Backend unavailable, showing fallback listings.");
        setListings([
          { id: 1, cropName: "Tomato", district: "Nashik", pricePerKg: 28, verifiedOnly: true, listingType: "produce" },
          { id: 2, cropName: "Onion", district: "Nagpur", pricePerKg: 25, verifiedOnly: true, listingType: "produce" },
          { id: 3, cropName: "Soybean", district: "Indore", pricePerKg: 42, verifiedOnly: false, listingType: "produce" }
        ]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter((x) => x.cropName.toLowerCase().includes(q) || x.district.toLowerCase().includes(q));
  }, [listings, search]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <AppTopBar />
      <View style={styles.searchRow}>
        <Ionicons name="mic-outline" size={18} color="#1f2b28" />
        <TextInput
          placeholder="Global search: produce, machinery, experts"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
        />
        <Ionicons name="search-outline" size={18} color="#1f2b28" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {filterChips.map((chip) => (
          <View key={chip} style={styles.filterChip}><Text style={styles.filterChipText}>{chip}</Text></View>
        ))}
      </ScrollView>

      <View style={styles.viewToggle}>
        <Pressable style={[styles.toggleBtn, viewMode === "grid" ? styles.toggleActive : null]} onPress={() => setViewMode("grid")}>
          <Text style={[styles.toggleText, viewMode === "grid" ? styles.toggleTextActive : null]}>Grid</Text>
        </Pressable>
        <Pressable style={[styles.toggleBtn, viewMode === "map" ? styles.toggleActive : null]} onPress={() => setViewMode("map")}>
          <Text style={[styles.toggleText, viewMode === "map" ? styles.toggleTextActive : null]}>Map</Text>
        </Pressable>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {viewMode === "map" ? (
        <View style={styles.mapMock}><Text style={styles.mapText}>Map View (placeholder)</Text></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardMedia}><Ionicons name="image-outline" size={22} color="#6a7b77" /></View>
              <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>Verified</Text></View>
              <View style={styles.cardBody}>
                <Text style={styles.cardMeta}>Farmer name | {item.district}</Text>
                <Text style={styles.cropName}>{item.cropName}</Text>
                <Text style={styles.cropPrice}>Rs {item.pricePerKg}/kg</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  searchRow: { margin: 12, borderRadius: 12, borderWidth: 1, borderColor: "#dfe5e3", backgroundColor: "#fff", paddingHorizontal: 10, alignItems: "center", flexDirection: "row", gap: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  chipRow: { paddingHorizontal: 10, gap: 8, paddingBottom: 8 },
  filterChip: { borderWidth: 1, borderColor: "#bfd1ca", backgroundColor: "#f6faf8", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  filterChipText: { color: "#2b3634", fontWeight: "600", fontSize: 12 },
  viewToggle: { marginHorizontal: 12, marginBottom: 8, flexDirection: "row", alignSelf: "flex-end", borderWidth: 1, borderColor: "#d8e1de", borderRadius: 9, overflow: "hidden" },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff" },
  toggleActive: { backgroundColor: "#0a9f46" },
  toggleText: { color: "#425350", fontWeight: "600" },
  toggleTextActive: { color: "#fff" },
  errorText: { color: "#b45309", fontWeight: "600", marginHorizontal: 12, marginBottom: 6 },
  mapMock: { margin: 12, borderRadius: 14, minHeight: 260, borderWidth: 1, borderColor: "#d8e3df", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  mapText: { color: "#5e706c", fontWeight: "700" },
  grid: { paddingHorizontal: 6, paddingBottom: 100 },
  card: { flex: 1, margin: 6, borderRadius: 14, borderWidth: 1, borderColor: "#dbe3e0", backgroundColor: "#fff", overflow: "hidden" },
  cardMedia: { height: 84, backgroundColor: "#eff4f2", alignItems: "center", justifyContent: "center" },
  verifiedBadge: { position: "absolute", right: 8, top: 8, backgroundColor: "#0a9f46", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  verifiedText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardBody: { padding: 9 },
  cardMeta: { color: "#60716d", fontSize: 11 },
  cropName: { marginTop: 4, color: "#1e2926", fontWeight: "700", fontSize: 16 },
  cropPrice: { marginTop: 4, color: "#0a9f46", fontSize: 16, fontWeight: "800" }
});
