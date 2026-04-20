import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fetchMarketplaceListings, MarketplaceListing } from "../services/api";
import { useCart } from "../cart/CartContext";
import type { MarketStackParamList } from "../navigation/MarketStackNavigator";

type MarketCategory = "All" |"Vegetables" | "Fruits" | "Dairy" | "InputsSupplies" | "Seeds" | "Fertilizers" | "Tools";

const TEAL = "#0d9488";
/** Slightly deeper teal for quantity pill (matches marketplace accent) */
const TEAL_STEPPER = "#0f766e";
const BG = "#f8f7f2";
const BORDER = "#e8e2d9";
const RED = "#ef4444";

const marketCategories: { id: MarketCategory; label: string }[] = [
  { id: "All", label: "All" },
  { id: "Vegetables", label: "Vegetables" },
  { id: "Fruits", label: "Fruits" },
  { id: "Dairy", label: "Dairy" },
  { id: "InputsSupplies", label: "Inputs & supplies" },
  { id: "Seeds", label: "Seeds" },
  { id: "Fertilizers", label: "Fertilizers" },
  { id: "Tools", label: "Tools" }
];

type Nav = NativeStackNavigationProp<MarketStackParamList, "MarketplaceHome">;

function rupee(n: number) {
  return "\u20B9" + Math.round(n).toLocaleString("en-IN");
}

function ratingFromId(id: number) {
  const v = (id % 7) + 38;
  return (v / 10).toFixed(1);
}

function matchesMarketCategory(name: string, cat: MarketCategory): boolean {
  const n = name.toLowerCase();
  if (cat === "All") return true;
  if (cat === "Dairy") {
    return ["milk", "ghee", "butter", "curd", "dairy", "paneer", "cheese", "cream", "yogurt", "lassi"].some((k) =>
      n.includes(k)
    );
  }
  if (cat === "Seeds") {
    return ["seed", "seeds", "hybrid", "germination", "sowing"].some((k) => n.includes(k));
  }
  if (cat === "Fertilizers") {
    return ["fert", "npk", "urea", "manure", "compost", "vermi", "nutrient", "ammonia", "dap"].some((k) =>
      n.includes(k)
    );
  }
  if (cat === "Tools") {
    return ["tool", "sprayer", "implement", "hammer", "drill", "sickle", "hoe", "trowel", "wheelbarrow", "16l"].some(
      (k) => n.includes(k)
    );
  }
  if (cat === "InputsSupplies") {
    return ["pesticide", "neem", "insect", "fungicide", "herbicide", "irrigation", "drip", "pump", "pipe", "mulch", "input", "supply", "sticker", "growth"].some(
      (k) => n.includes(k)
    );
  }
  return true;
}

function liveDealUnit(index: number) {
  return index % 2 === 0 ? "/ 500g" : "/ kg";
}

function ListingCartControl({
  listing,
  index,
  variant
}: {
  listing: MarketplaceListing;
  index: number;
  variant: "live" | "grid";
}) {
  const { addFromListing, setQuantity, getQuantity } = useCart();
  const qty = getQuantity(listing.id);

  if (qty === 0) {
    return (
      <Pressable
        style={variant === "live" ? styles.liveAdd : styles.addCircle}
        onPress={() => addFromListing(listing, index)}
        accessibilityRole="button"
        accessibilityLabel="Add to cart"
      >
        <Ionicons name="add" size={22} color="#fff" />
      </Pressable>
    );
  }

  return (
    <View style={variant === "live" ? styles.liveQtyPill : styles.gridQtyPill} accessibilityRole="adjustable">
      <Pressable
        style={styles.qtyPillSide}
        onPress={() => setQuantity(listing.id, qty - 1)}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        hitSlop={8}
      >
        <Text style={styles.qtyPillGlyph}>−</Text>
      </Pressable>
      <Text style={styles.qtyPillCount}>{qty}</Text>
      <Pressable
        style={styles.qtyPillSide}
        onPress={() => setQuantity(listing.id, qty + 1)}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        hitSlop={8}
      >
        <Text style={styles.qtyPillGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

export function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { addFromListing, itemCount } = useCart();

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<MarketCategory>("All");
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
        setErrorMessage("Showing sample products.");
        setListings([
          { id: 1, cropName: "Organic Strawberries", district: "Arshi Smart Farm", pricePerKg: 180, verifiedOnly: true },
          { id: 2, cropName: "Hybrid Tomato Seeds (Anka)", district: "Mahyo Agri", pricePerKg: 320, verifiedOnly: true },
          { id: 3, cropName: "NPK Fertilizer 19-19-19", district: "Coromandel Agri", pricePerKg: 1450, verifiedOnly: true },
          { id: 4, cropName: "Portable Sprayer (16L)", district: "Green Tools", pricePerKg: 2200, verifiedOnly: true },
          { id: 5, cropName: "Vermicompost (Premium)", district: "Earthworm Co", pricePerKg: 890, verifiedOnly: true },
          { id: 6, cropName: "Drip Irrigation Kit (1 acre)", district: "Irrigation Hub", pricePerKg: 560, verifiedOnly: true },
          { id: 7, cropName: "Basmati Rice (Premium)", district: "Punjab Grains", pricePerKg: 120, verifiedOnly: true },
          { id: 8, cropName: "Alphonso Mango (Ratnagiri)", district: "Konkan Fruits", pricePerKg: 450, verifiedOnly: true },
          { id: 9, cropName: "Wheat Seeds HD-3086", district: "Krishi Seeds", pricePerKg: 65, verifiedOnly: false },
          { id: 10, cropName: "Neem Oil Pesticide", district: "Trusted Brand", pricePerKg: 220, verifiedOnly: false },
          { id: 11, cropName: "Fresh Cow Milk (Toned)", district: "Nashik Dairy Co-op", pricePerKg: 56, verifiedOnly: true },
          { id: 12, cropName: "Organic Cow Ghee 500ml", district: "Gopal Farms", pricePerKg: 650, verifiedOnly: true }
        ]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((p) => {
      const textOk = !q || p.cropName.toLowerCase().includes(q) || p.district.toLowerCase().includes(q);
      return textOk && matchesMarketCategory(p.cropName, activeCat);
    });
  }, [listings, search, activeCat]);

  const liveDeals = useMemo(() => filtered.slice(0, 5), [filtered]);

  const listHeader = (
    <>
      <View style={styles.topBar}>
        <View style={styles.locationRow}>
          <View style={styles.logoDot} />
          <View style={styles.locationChip}>
            <Ionicons name="location-outline" size={14} color="#1f2c29" />
            <Text style={styles.locationText}>Nashik, MH</Text>
            <Ionicons name="chevron-down" size={14} color="#1f2c29" />
          </View>
        </View>
        <View style={styles.topIcons}>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="search-outline" size={18} color="#1f2c29" />
          </Pressable>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={18} color="#1f2c29" />
            <View style={styles.notifDot} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate("Cart")}>
            <Ionicons name="cart-outline" size={18} color="#1f2c29" />
            {itemCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{itemCount > 99 ? "99+" : itemCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="person-outline" size={18} color="#1f2c29" />
          </Pressable>
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title}>Agri Market</Text>
        <Pressable style={styles.filterSquare}>
          <Ionicons name="options-outline" size={20} color="#1f2c29" />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#64748b" />
        <TextInput
          placeholder="Search produce, farmers, equipment..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
        />
        <Ionicons name="mic-outline" size={18} color="#64748b" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {marketCategories.map((c) => {
          const on = activeCat === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setActiveCat(c.id)}
              style={[styles.catChip, on ? styles.catChipOn : null]}
            >
              <Text style={[styles.catText, on ? styles.catTextOn : null]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Text style={styles.sectionLabel}>Live deals</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveRow}>
        {liveDeals.map((item, idx) => {
          const globalIndex = listings.findIndex((l) => l.id === item.id);
          const i = globalIndex >= 0 ? globalIndex : idx;
          return (
            <View key={item.id} style={styles.liveCard}>
              <View style={styles.liveBadges}>
                <View style={styles.livePill}>
                  <Text style={styles.livePillText}>LIVE</Text>
                </View>
                <View style={styles.stockPill}>
                  <Text style={styles.stockPillText}>{3 + (idx % 4)} left</Text>
                </View>
              </View>
              <View style={[styles.liveMedia, { backgroundColor: idx % 2 === 0 ? "#ecfdf5" : "#fff7ed" }]}>
                <Ionicons name="nutrition-outline" size={36} color={TEAL} />
              </View>
              <Text style={styles.liveName} numberOfLines={2}>
                {item.cropName}
              </Text>
              <Text style={styles.liveVendor} numberOfLines={1}>
                {item.district}
              </Text>
              <View style={styles.liveTimerRow}>
                <Ionicons name="time-outline" size={12} color="#64748b" />
                <Text style={styles.liveTimer}>02:34:{String(33 + idx).padStart(2, "0")}</Text>
              </View>
              <Text style={styles.livePrice}>
                {rupee(item.pricePerKg)} {liveDealUnit(idx)}
              </Text>
              <ListingCartControl listing={item} index={i} variant="live" />
            </View>
          );
        })}
      </ScrollView>

      <Text style={styles.countText}>{filtered.length} products found</Text>
    </>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: insets.bottom + 88 }}
        columnWrapperStyle={styles.columnWrap}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const tint = index % 2 === 0 ? "#ecfdf5" : "#eff6ff";
          const discount = index % 2 === 0 ? "-10%" : "-5%";
          const tag = item.verifiedOnly ? (index % 2 ? "Top Rated" : "Bestseller") : "Trusted";
          const reviews = 180 + (item.id % 80);
          return (
            <View style={styles.card}>
              <View style={styles.badgeRow}>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>{discount}</Text>
                </View>
                <View style={styles.tagBadge}>
                  <Text style={styles.tagBadgeText}>{tag}</Text>
                </View>
              </View>
              <Pressable onPress={() => setSelected({ item, index })} style={[styles.media, { backgroundColor: tint }]}>
                <Ionicons name={index % 2 === 0 ? "leaf-outline" : "flask-outline"} size={40} color={TEAL} />
              </Pressable>
              <Text style={styles.productName} numberOfLines={2}>
                {item.cropName}
              </Text>
              <Text style={styles.seller} numberOfLines={1}>
                {item.district}
              </Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#f59e0b" />
                <Text style={styles.ratingText}>{ratingFromId(item.id)}</Text>
                <Text style={styles.ratingSub}>({reviews})</Text>
              </View>
              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.price}>{rupee(item.pricePerKg)}</Text>
                  <Text style={styles.unit}>{index % 2 === 0 ? "/ 500g pack" : "/ unit"}</Text>
                </View>
                <ListingCartControl listing={item} index={index} variant="grid" />
              </View>
            </View>
          );
        }}
      />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected ? (
          <ProductDetail item={selected.item} index={selected.index} onClose={() => setSelected(null)} />
        ) : null}
      </Modal>
    </View>
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
  const { addFromListing, setQuantity, getQuantity } = useCart();
  const qty = getQuantity(item.id);
  const discount = index % 2 === 0 ? "-10% OFF" : "-5%";
  const tag = item.verifiedOnly ? (index % 2 ? "Bestseller" : "Verified Store") : "Trusted Brand";
  const rating = ratingFromId(item.id);

  return (
    <View style={detailStyles.detailScreen}>
      <View style={detailStyles.detailTopBar}>
        <Pressable onPress={onClose} style={detailStyles.detailBackBtn}>
          <Ionicons name="arrow-back" size={20} color="#1f2c29" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable style={detailStyles.detailCartTiny}>
          <Ionicons name="cart-outline" size={20} color={TEAL} />
        </Pressable>
      </View>

      <View style={detailStyles.detailHeader}>
        <Text style={detailStyles.detailBreadcrumb}>{item.district}</Text>
        <Text style={detailStyles.detailProductTag}>
          {discount} • {tag}
        </Text>
      </View>

      <View style={[detailStyles.detailHero, { backgroundColor: index % 2 === 0 ? "#d1fae5" : "#dbeafe" }]}>
        <View style={detailStyles.detailHeroIconWrap}>
          <Ionicons name={index % 2 === 0 ? "leaf-outline" : "flask-outline"} size={54} color={TEAL} />
        </View>
      </View>

      <View style={detailStyles.detailBody}>
        <View style={detailStyles.detailPriceRow}>
          <Text style={detailStyles.detailPrice}>{rupee(item.pricePerKg)}</Text>
          <Text style={detailStyles.detailUnit}>/ pack</Text>
        </View>

        <View style={detailStyles.detailRatingRow}>
          <Ionicons name="star" size={16} color="#f59e0b" />
          <Text style={detailStyles.detailRatingText}>
            {rating} (218 reviews)
          </Text>
        </View>

        <Text style={detailStyles.detailSellerLine}>
          {item.verifiedOnly ? "Verified Seller" : "Seller"} • Quality checked
        </Text>

        <View style={detailStyles.detailButtonsRow}>
          <Pressable style={detailStyles.detailPrimaryBtn} onPress={onClose}>
            <Text style={detailStyles.detailPrimaryBtnText}>View Store</Text>
          </Pressable>
          {qty === 0 ? (
            <Pressable style={detailStyles.detailSecondaryBtn} onPress={() => addFromListing(item, index)}>
              <Text style={detailStyles.detailSecondaryBtnText}>Add</Text>
            </Pressable>
          ) : (
            <View style={detailStyles.detailQtyPill}>
              <Pressable
                style={detailStyles.detailQtySide}
                onPress={() => setQuantity(item.id, qty - 1)}
                hitSlop={8}
              >
                <Text style={detailStyles.detailQtyGlyph}>−</Text>
              </Pressable>
              <Text style={detailStyles.detailQtyCount}>{qty}</Text>
              <Pressable
                style={detailStyles.detailQtySide}
                onPress={() => setQuantity(item.id, qty + 1)}
                hitSlop={8}
              >
                <Text style={detailStyles.detailQtyGlyph}>+</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text style={detailStyles.detailSectionTitle}>About this product</Text>
        <Text style={detailStyles.detailSectionText}>
          High-quality {item.cropName} with trusted supply and fast availability. Delivery timeline depends on district.
        </Text>

        <Text style={detailStyles.detailSectionTitle}>Customer Reviews</Text>
        <View style={detailStyles.reviewCard}>
          <Text style={detailStyles.reviewName}>Ganesh Pawar</Text>
          <Text style={detailStyles.reviewText}>
            Excellent product, exactly as described. Delivery was fast and packaging was intact.
          </Text>
          <Text style={detailStyles.reviewMeta}>Apr 2026 • Helpful</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#eab308" },
  locationChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontWeight: "700", color: "#1f2c29", fontSize: 13 },
  topIcons: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center"
  },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RED
  },
  cartBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  cartBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    marginTop: 4
  },
  title: { fontSize: 26, fontWeight: "800", color: "#1f2c29" },
  filterSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center"
  },
  searchRow: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: "#1f2c29" },
  categoryRow: { gap: 8, paddingHorizontal: 12, marginTop: 12, paddingBottom: 4 },
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER
  },
  catChipOn: { backgroundColor: TEAL, borderColor: TEAL },
  catText: { fontWeight: "700", color: "#475569", fontSize: 13 },
  catTextOn: { color: "#fff" },
  errorText: { paddingHorizontal: 12, marginTop: 6, color: "#b45309", fontWeight: "600", fontSize: 12 },
  sectionLabel: {
    paddingHorizontal: 12,
    marginTop: 14,
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.5
  },
  liveRow: { gap: 12, paddingHorizontal: 12, marginTop: 10 },
  liveCard: {
    width: 168,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 10,
    position: "relative",
    paddingBottom: 44
  },
  liveBadges: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  livePill: { backgroundColor: RED, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  livePillText: { color: "#fff", fontWeight: "900", fontSize: 10 },
  stockPill: { backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  stockPillText: { color: "#b45309", fontWeight: "800", fontSize: 10 },
  liveMedia: { height: 88, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  liveName: { marginTop: 8, fontWeight: "800", color: "#1f2c29", fontSize: 13 },
  liveVendor: { marginTop: 2, color: "#64748b", fontSize: 11, fontWeight: "600" },
  liveTimerRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  liveTimer: { color: "#64748b", fontSize: 11, fontWeight: "600" },
  livePrice: { marginTop: 6, fontWeight: "900", color: "#1f2c29", fontSize: 15 },
  liveAdd: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center"
  },
  liveQtyPill: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEAL_STEPPER,
    borderRadius: 999,
    minHeight: 40,
    paddingHorizontal: 2,
    minWidth: 112
  },
  gridQtyPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEAL_STEPPER,
    borderRadius: 999,
    minHeight: 40,
    paddingHorizontal: 2,
    minWidth: 108
  },
  qtyPillSide: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6
  },
  qtyPillGlyph: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22
  },
  qtyPillCount: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    minWidth: 28,
    textAlign: "center"
  },
  countText: { paddingHorizontal: 12, marginTop: 14, marginBottom: 8, color: "#475569", fontWeight: "700", fontSize: 13 },
  columnWrap: { paddingHorizontal: 8, gap: 0 },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 10,
    marginHorizontal: 6,
    marginBottom: 12,
    maxWidth: "50%"
  },
  badgeRow: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "space-between" },
  discountBadge: { backgroundColor: RED, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  discountBadgeText: { color: "#fff", fontWeight: "900", fontSize: 10 },
  tagBadge: { borderWidth: 1, borderColor: TEAL, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#fff" },
  tagBadgeText: { color: TEAL, fontWeight: "800", fontSize: 10 },
  media: { height: 120, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
  productName: { marginTop: 10, fontWeight: "800", color: "#1f2c29", fontSize: 13 },
  seller: { marginTop: 3, color: "#64748b", fontWeight: "600", fontSize: 11 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  ratingText: { fontWeight: "800", color: "#1f2c29", fontSize: 12 },
  ratingSub: { color: "#64748b", fontWeight: "600", fontSize: 11 },
  priceRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 },
  price: { fontWeight: "900", color: "#1f2c29", fontSize: 16 },
  unit: { color: "#64748b", fontWeight: "600", fontSize: 10, marginTop: 1 },
  addCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center"
  }
});

const detailStyles = StyleSheet.create({
  detailScreen: { flex: 1, backgroundColor: BG, paddingTop: 48 },
  detailTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 6 },
  detailBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center"
  },
  detailCartTiny: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center"
  },
  detailHeader: { paddingHorizontal: 12, marginTop: 8 },
  detailBreadcrumb: { color: "#475569", fontWeight: "700" },
  detailProductTag: { marginTop: 6, color: TEAL, fontWeight: "800" },
  detailHero: { marginHorizontal: 12, marginTop: 10, borderRadius: 16, height: 180, alignItems: "center", justifyContent: "center" },
  detailHeroIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center"
  },
  detailBody: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 40 },
  detailPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  detailPrice: { fontWeight: "900", color: "#1f2c29", fontSize: 24 },
  detailUnit: { fontWeight: "700", color: "#64748b", fontSize: 12 },
  detailRatingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  detailRatingText: { color: "#1f2c29", fontWeight: "700" },
  detailSellerLine: { marginTop: 8, color: "#64748b", fontWeight: "600" },
  detailButtonsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  detailPrimaryBtn: {
    flex: 1,
    backgroundColor: TEAL,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  detailPrimaryBtnText: { color: "#fff", fontWeight: "900" },
  detailSecondaryBtn: {
    width: 86,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  detailSecondaryBtnText: { color: TEAL, fontWeight: "900" },
  detailQtyPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEAL_STEPPER,
    borderRadius: 999,
    minHeight: 44,
    paddingHorizontal: 2,
    minWidth: 118
  },
  detailQtySide: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8
  },
  detailQtyGlyph: { color: "#fff", fontSize: 22, fontWeight: "700" },
  detailQtyCount: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    minWidth: 32,
    textAlign: "center"
  },
  detailSectionTitle: { marginTop: 16, fontWeight: "900", color: "#1f2c29" },
  detailSectionText: { marginTop: 6, color: "#475569", lineHeight: 20 },
  reviewCard: { marginTop: 10, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 12 },
  reviewName: { fontWeight: "900", color: "#1f2c29" },
  reviewText: { marginTop: 6, color: "#475569", lineHeight: 18 },
  reviewMeta: { marginTop: 8, color: "#64748b", fontWeight: "600", fontSize: 12 }
});
