import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { fetchMarketplaceListings, MarketplaceListing } from "../services/api";

type Category =
  | "All"
  | "Seeds"
  | "Fertilizers"
  | "Tools"
  | "Equipment"
  | "Pesticides"
  | "Irrigation"
  | "Testing"
  | "Infrastructure";

const categories: { id: Category; icon: any }[] = [
  { id: "All", icon: "apps" },
  { id: "Seeds", icon: "leaf-outline" },
  { id: "Fertilizers", icon: "flask-outline" },
  { id: "Tools", icon: "hammer-outline" },
  { id: "Equipment", icon: "cube-outline" },
  { id: "Pesticides", icon: "bug-outline" },
  { id: "Irrigation", icon: "water-drop-outline" },
  { id: "Testing", icon: "microscope-outline" },
  { id: "Infrastructure", icon: "building-outline" }
];

function rupee(n: number) {
  return `₹${Math.round(n)}`;
}

function ratingFromId(id: number) {
  const v = (id % 7) + 38;
  return (v / 10).toFixed(1);
}

export function MarketplaceScreen() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<Category>("All");
  const [selected, setSelected] = useState<{ item: MarketplaceListing; index: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchMarketplaceListings()
      .then((data) => {
        if (!mounted) return;
        setListings(data.listings);
      })
      .catch(() => {
        if (!mounted) return;
        setErrorMessage("Backend unavailable, showing fallback products.");
        setListings([
          { id: 1, cropName: "Hybrid Tomato Seeds (Anka Ratshak)", district: "Mahyo Agri", pricePerKg: 320, verifiedOnly: true },
          { id: 2, cropName: "NPK Fertilizer 19-19-19", district: "Coromandel Agri", pricePerKg: 1450, verifiedOnly: true },
          { id: 3, cropName: "Neem Pesticide Spray", district: "Trusted Brand", pricePerKg: 220, verifiedOnly: false },
          { id: 4, cropName: "Garden Tools Set (Hand Implements)", district: "Green Tools", pricePerKg: 180, verifiedOnly: true },
          { id: 5, cropName: "Tractor Equipment Seed Drill", district: "Kisan Equipments", pricePerKg: 980, verifiedOnly: true },
          { id: 6, cropName: "Drip Irrigation Kit (1 acre)", district: "Irrigation Hub", pricePerKg: 560, verifiedOnly: true },
          { id: 7, cropName: "Soil Testing Kit + pH meter", district: "Soil Labs", pricePerKg: 310, verifiedOnly: false },
          { id: 8, cropName: "Cold Storage Infrastructure (Storage unit)", district: "Agri Infra", pricePerKg: 210, verifiedOnly: false }
        ]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = listings.filter((p) => {
      return !q || p.cropName.toLowerCase().includes(q) || p.district.toLowerCase().includes(q);
    });

    if (activeCat === "All") return base;

    const cat = base.filter((p) => {
      const name = p.cropName.toLowerCase();
      if (activeCat === "Seeds") return name.includes("seed");
      if (activeCat === "Fertilizers") return name.includes("fert") || name.includes("npk") || name.includes("urea");
      if (activeCat === "Tools") return name.includes("tool") || name.includes("implement");
      if (activeCat === "Equipment") return name.includes("equip") || name.includes("tractor") || name.includes("machine");
      if (activeCat === "Pesticides") return name.includes("pesticide") || name.includes("spray") || name.includes("neem");
      if (activeCat === "Irrigation") return name.includes("irrigation") || name.includes("drip") || name.includes("pump");
      if (activeCat === "Testing") return name.includes("test") || name.includes("testing") || name.includes("soil") || name.includes("meter");
      if (activeCat === "Infrastructure") return name.includes("infra") || name.includes("storage") || name.includes("warehouse") || name.includes("cold");
      return true;
    });

    // Prevent empty screens for now (current API is produce-focused).
    return cat.length ? cat : base;
  }, [listings, search, activeCat]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.locationChip}>
          <Ionicons name="location-outline" size={14} color="#2b3634" />
          <Text style={styles.locationText}>Nashik, MH</Text>
          <Ionicons name="chevron-down" size={14} color="#2b3634" />
        </View>
        <View style={styles.topIcons}>
          <Pressable style={styles.topIconBtn}>
            <Ionicons name="search-outline" size={18} color="#2b3634" />
          </Pressable>
          <Pressable style={styles.topIconBtn}>
            <Ionicons name="notifications-outline" size={18} color="#2b3634" />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>3</Text>
            </View>
          </Pressable>
          <Pressable style={styles.topIconBtn}>
            <Ionicons name="cart-outline" size={18} color="#2b3634" />
          </Pressable>
        </View>
      </View>

      <Text style={styles.title}>Agri Market</Text>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color="#6a7673" />
        <TextInput
          placeholder="Search seeds, fertilizers, tools, equipment, pesticides..."
          placeholderTextColor="#7f8f8a"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
        />
        <Ionicons name="mic-outline" size={16} color="#6a7673" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {categories.map((c) => {
          const on = activeCat === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setActiveCat(c.id)}
              style={[styles.catChip, on ? styles.catChipOn : null]}
            >
              <Ionicons name={c.icon} size={14} color={on ? "#fff" : "#4d5f5a"} />
              <Text style={[styles.catText, on ? styles.catTextOn : null]}>{c.id}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.countText}>{filtered.length} products found</Text>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.grid}
        renderItem={({ item, index }) => {
          const tint = index % 2 === 0 ? "#dff3e9" : "#e6f1ff";
          const discount = index % 2 === 0 ? "-10%" : "-5%";
          const tag = item.verifiedOnly ? (index % 2 ? "Top Rated" : "Bestseller") : "Trusted Brand";
          return (
            <Pressable
              onPress={() => setSelected({ item, index })}
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }, styles.card]}
            >
              <View style={styles.badgeRow}>
                <View style={styles.smallBadge}>
                  <Text style={styles.smallBadgeText}>{discount}</Text>
                </View>
                <View style={styles.smallBadgeOutline}>
                  <Text style={styles.smallBadgeOutlineText}>{tag}</Text>
                </View>
              </View>

              <View style={[styles.media, { backgroundColor: tint }]}>
                <Ionicons name={index % 2 === 0 ? "leaf-outline" : "construct-outline"} size={40} color="#0a9f46" />
              </View>

              <Text style={styles.productName} numberOfLines={2}>{item.cropName}</Text>
              <Text style={styles.seller} numberOfLines={1}>{item.district}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#f59e0b" />
                <Text style={styles.ratingText}>{ratingFromId(item.id)}</Text>
                <Text style={styles.ratingSub}>(218)</Text>
              </View>

              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.price}>{rupee(item.pricePerKg)}</Text>
                  <Text style={styles.unit}>/50g pack</Text>
                </View>
                <Pressable style={styles.cartBtn} accessibilityLabel="Add to cart">
                  <Ionicons name="cart" size={16} color="#fff" />
                </Pressable>
              </View>
            </Pressable>
          );
        }}
      />

      <Modal
        visible={!!selected}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelected(null)}
      >
        {selected ? (
          <ProductDetail
            item={selected.item}
            index={selected.index}
            onClose={() => setSelected(null)}
          />
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

function ProductDetail({
  item,
  index,
  onClose
}: {
  item: MarketplaceListing;
  index: number;
  onClose: () => void;
}) {
  const discount = index % 2 === 0 ? "-10% OFF" : "-5%";
  const tag = item.verifiedOnly ? (index % 2 ? "Bestseller" : "Verified Store") : "Trusted Brand";
  const rating = ratingFromId(item.id);

  return (
    <SafeAreaView style={styles.detailScreen}>
      <View style={styles.detailTopBar}>
        <Pressable onPress={onClose} style={styles.detailBackBtn}>
          <Text style={styles.detailBackText}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.detailCartTiny} accessibilityLabel="Cart">
          <Ionicons name="cart-outline" size={18} color="#0a9f46" />
        </Pressable>
      </View>

      <View style={styles.detailHeader}>
        <Text style={styles.detailBreadcrumb}>📍 {item.district}</Text>
        <Text style={styles.detailProductTag}>{discount} • {tag}</Text>
      </View>

      <View style={[styles.detailHero, { backgroundColor: index % 2 === 0 ? "#d1fae5" : "#dbeafe" }]}>
        <View style={styles.detailHeroIconWrap}>
          <Ionicons name={index % 2 === 0 ? "leaf-outline" : "flask-outline"} size={54} color="#0a9f46" />
        </View>
      </View>

      <View style={styles.detailBody}>
        <View style={styles.detailPriceRow}>
          <Text style={styles.detailPrice}>{rupee(item.pricePerKg)}</Text>
          <Text style={styles.detailUnit}>/50g pack</Text>
        </View>

        <View style={styles.detailRatingRow}>
          <Ionicons name="star" size={16} color="#f59e0b" />
          <Text style={styles.detailRatingText}>{rating} ({218} reviews)</Text>
        </View>

        <Text style={styles.detailSellerLine}>
          {item.verifiedOnly ? "Verified Seller" : "Seller"} • Quality checked
        </Text>

        <View style={styles.detailButtonsRow}>
          <Pressable style={styles.detailPrimaryBtn} onPress={() => {}}>
            <Text style={styles.detailPrimaryBtnText}>View Store</Text>
          </Pressable>
          <Pressable style={styles.detailSecondaryBtn} onPress={() => {}}>
            <Text style={styles.detailSecondaryBtnText}>Add</Text>
          </Pressable>
        </View>

        <Text style={styles.detailSectionTitle}>About this product</Text>
        <Text style={styles.detailSectionText}>
          High-quality {item.cropName} with trusted supply and fast availability. Delivery timeline depends on district.
        </Text>

        <Text style={styles.detailSectionTitle}>Customer Reviews</Text>
        <View style={styles.reviewCard}>
          <Text style={styles.reviewName}>Ganesh Throat</Text>
          <Text style={styles.reviewText}>Excellent product, exactly as described. Delivery was fast and packaging was intact.</Text>
          <Text style={styles.reviewMeta}>Apr 2026 • Helpful</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f1ed" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 8 },
  locationChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationText: { fontWeight: "700", color: "#1f2c29" },
  topIcons: { flexDirection: "row", alignItems: "center", gap: 10 },
  topIconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eadfd6", alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", right: 6, top: 6, backgroundColor: "#ef4444", borderRadius: 8, minWidth: 14, height: 14, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  title: { fontSize: 22, fontWeight: "800", color: "#1f2c29", paddingHorizontal: 12, marginTop: 8 },
  searchRow: { marginHorizontal: 12, marginTop: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eadfd6", borderRadius: 12, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: "#1f2c29" },
  categoryRow: { gap: 8, paddingHorizontal: 12, marginTop: 10, alignItems: "center" },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eadfd6" },
  catChipOn: { backgroundColor: "#ef4444", borderColor: "#ef4444" },
  catText: { fontWeight: "700", color: "#4d5f5a", fontSize: 12 },
  catTextOn: { color: "#fff" },
  countText: { paddingHorizontal: 12, marginTop: 10, color: "#4d5f5a", fontWeight: "700" },
  errorText: { paddingHorizontal: 12, marginTop: 4, color: "#b45309", fontWeight: "700" },
  grid: { paddingHorizontal: 8, paddingBottom: 100, paddingTop: 6 },
  card: { flex: 1, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#eadfd6", padding: 10, margin: 6 },
  badgeRow: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "space-between" },
  smallBadge: { backgroundColor: "#ef4444", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  smallBadgeText: { color: "#fff", fontWeight: "900", fontSize: 10 },
  smallBadgeOutline: { borderWidth: 1, borderColor: "#ef4444", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#fff" },
  smallBadgeOutlineText: { color: "#ef4444", fontWeight: "900", fontSize: 10 },
  media: { height: 120, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 10 },
  productName: { marginTop: 10, fontWeight: "800", color: "#1f2c29" },
  seller: { marginTop: 3, color: "#6b7976", fontWeight: "600", fontSize: 12 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  ratingText: { fontWeight: "800", color: "#1f2c29" },
  ratingSub: { color: "#6b7976", fontWeight: "600" },
  priceRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 },
  price: { fontWeight: "900", color: "#1f2c29", fontSize: 16 },
  unit: { color: "#6b7976", fontWeight: "700", fontSize: 11, marginTop: 1 },
  cartBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" }
  ,
  // Product detail modal/screen
  detailScreen: { flex: 1, backgroundColor: "#f6f1ed" },
  detailTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 6 },
  detailBackBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eadfd6", alignItems: "center", justifyContent: "center" },
  detailBackText: { fontSize: 18, fontWeight: "700", color: "#0a9f46" },
  detailCartTiny: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eadfd6", alignItems: "center", justifyContent: "center" },
  detailHeader: { paddingHorizontal: 12, marginTop: 8 },
  detailBreadcrumb: { color: "#2b3634", fontWeight: "700" },
  detailProductTag: { marginTop: 6, color: "#0a9f46", fontWeight: "800" },
  detailHero: { marginHorizontal: 12, marginTop: 10, borderRadius: 16, height: 180, alignItems: "center", justifyContent: "center" },
  detailHeroIconWrap: { width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.55)", alignItems: "center", justifyContent: "center" },
  detailBody: { paddingHorizontal: 12, paddingTop: 14 },
  detailPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  detailPrice: { fontWeight: "900", color: "#1f2c29", fontSize: 24 },
  detailUnit: { fontWeight: "700", color: "#6b7976", fontSize: 12 },
  detailRatingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  detailRatingText: { color: "#1f2c29", fontWeight: "700" },
  detailSellerLine: { marginTop: 8, color: "#6b7976", fontWeight: "600" },
  detailButtonsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  detailPrimaryBtn: { flex: 1, backgroundColor: "#0a9f46", borderRadius: 10, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  detailPrimaryBtnText: { color: "#fff", fontWeight: "900" },
  detailSecondaryBtn: { width: 86, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#0a9f46", alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  detailSecondaryBtnText: { color: "#0a9f46", fontWeight: "900" },
  detailSectionTitle: { marginTop: 16, fontWeight: "900", color: "#1f2c29" },
  detailSectionText: { marginTop: 6, color: "#4b5a56", lineHeight: 20 },
  reviewCard: { marginTop: 10, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#eadfd6", padding: 12 },
  reviewName: { fontWeight: "900", color: "#1f2c29" },
  reviewText: { marginTop: 6, color: "#4b5a56", lineHeight: 18 },
  reviewMeta: { marginTop: 8, color: "#6b7976", fontWeight: "600", fontSize: 12 }
});
