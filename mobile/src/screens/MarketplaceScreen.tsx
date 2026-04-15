import React, { useEffect, useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppTopBar } from "../components/AppTopBar";
import { fetchMarketplaceListings, MarketplaceListing } from "../services/api";

const chips = ["All", "Grains", "Vegetables", "Fruits", "Spices", "Cotton", "Pulses", "All Districts"];

export function MarketplaceScreen() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    fetchMarketplaceListings()
      .then((data) => {
        if (!mounted) return;
        setListings(data.listings);
      })
      .catch(() => {
        if (!mounted) return;
        setErrorMessage("Backend unavailable, showing fallback listings.");
        setListings([
          { id: 1, cropName: "Tomato", district: "Nashik", pricePerKg: 28, verifiedOnly: true },
          { id: 2, cropName: "Onion", district: "Nagpur", pricePerKg: 25, verifiedOnly: true },
          { id: 3, cropName: "Soybean", district: "Indore", pricePerKg: 42, verifiedOnly: false }
        ]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const cardData = useMemo(() => listings, [listings]);

  return (
    <View style={styles.screen}>
      <AppTopBar />
      <View style={styles.marketHeader}>
        <TextInput placeholder="Search produce, farmers..." style={styles.marketSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {chips.map((chip, index) => (
            <View key={chip} style={[styles.filterChip, index === 0 ? styles.activeChip : null]}>
              <Text style={[styles.filterChipText, index === 0 ? styles.activeChipText : null]}>{chip}</Text>
            </View>
          ))}
        </ScrollView>
        <Text style={styles.listingCount}>{cardData.length} listings found</Text>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </View>
      <FlatList
        data={cardData}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.grid}
        renderItem={({ item, index }) => (
          <View style={[styles.card, { backgroundColor: index % 2 ? "#ff5f6d" : "#f5cb3d" }]}>
            <View style={styles.verifiedDot}>
              <Text style={styles.verifiedText}>{item.verifiedOnly ? "✓" : "•"}</Text>
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.cropName}>{item.cropName}</Text>
              <Text style={styles.cropMeta}>📍 {item.district}</Text>
              <Text style={styles.cropPrice}>₹{item.pricePerKg}/kg</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  marketHeader: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#dde5e2", paddingBottom: 8 },
  marketSearch: { marginHorizontal: 12, marginVertical: 10, backgroundColor: "#f2f0eb", borderRadius: 10, borderWidth: 1, borderColor: "#e6e6de", paddingHorizontal: 14, paddingVertical: 10 },
  chipRow: { paddingHorizontal: 10, gap: 8, alignItems: "center" },
  filterChip: { borderRadius: 18, borderWidth: 1, borderColor: "#c4d3cc", backgroundColor: "#f7fbf9", paddingHorizontal: 14, paddingVertical: 9 },
  activeChip: { backgroundColor: "#0a9f46", borderColor: "#0a9f46" },
  filterChipText: { color: "#2b3634", fontWeight: "600" },
  activeChipText: { color: "#fff" },
  listingCount: { marginTop: 8, paddingHorizontal: 12, color: "#1f2b28", fontSize: 16, fontWeight: "600" },
  errorText: { color: "#b45309", fontWeight: "600", marginTop: 4, paddingHorizontal: 12 },
  grid: { padding: 6 },
  card: { flex: 1, margin: 6, borderRadius: 16, minHeight: 170, justifyContent: "space-between" },
  verifiedDot: { position: "absolute", right: 10, top: 10, backgroundColor: "#15b060", borderRadius: 20, width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  verifiedText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardBottom: { backgroundColor: "rgba(255,255,255,0.86)", borderBottomLeftRadius: 16, borderBottomRightRadius: 16, padding: 10 },
  cropName: { color: "#1e2926", fontWeight: "700", fontSize: 16 },
  cropMeta: { color: "#4e5c59", marginTop: 2 },
  cropPrice: { color: "#0a9f46", fontWeight: "700", marginTop: 5, fontSize: 16 }
});
