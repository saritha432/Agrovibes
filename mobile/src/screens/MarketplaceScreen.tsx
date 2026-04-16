import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchMarketplaceListings, MarketplaceListing } from "../services/api";

type MarketSection = "produce" | "machinery" | "knowledge" | "services";

const quickTags = ["Wheat", "Tractor rental", "Organic tomatoes", "Irrigation kit", "Soil testing", "Basmati rice", "Expert consultation"];
const topTabs: { id: MarketSection; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "produce", label: "Fresh Produce", icon: "leaf-outline" },
  { id: "machinery", label: "Machinery", icon: "construct-outline" },
  { id: "knowledge", label: "Knowledge", icon: "book-outline" },
  { id: "services", label: "Services", icon: "briefcase-outline" }
];

const subTabs: Record<MarketSection, string[]> = {
  produce: ["All", "Fruits", "Vegetables", "Grains & Pulses", "Spices & Herbs", "Organic"],
  machinery: ["All", "Tractors", "Harvesting", "Irrigation", "Tools", "Tech"],
  knowledge: ["All", "Courses", "Consultations", "Documentation", "Certifications"],
  services: ["All", "Equipment Rental", "Labor", "Transportation", "Processing", "Storage"]
};

type MachineCard = { id: string; title: string; owner: string; district: string; rating: number; price: string; status: string };
type KnowledgeCard = { id: string; name: string; area: string; detail: string; rating: number; sessions: number; next: string; price: string; status: string };
type ServiceCard = { id: string; title: string; provider: string; rating: number; price: string; status: string };

const machineData: MachineCard[] = [
  { id: "m1", title: "Mahindra 575 DI", owner: "Harnam Singh", district: "Ludhiana", rating: 4.7, price: "Rs 1,800/day", status: "Available" },
  { id: "m2", title: "Sonalika GT 750", owner: "Kisan Co-op", district: "Bhopal", rating: 4.6, price: "Rs 1,650/day", status: "Available" }
];

const knowledgeData: KnowledgeCard[] = [
  { id: "k1", name: "Dr. Meena Sharma", area: "Soil Science", detail: "PhD Soil Science, IARI, 15yr exp", rating: 4.9, sessions: 347, next: "Today 3:00 PM", price: "Rs 300/hr", status: "Available" },
  { id: "k2", name: "Rajiv Aggarwal", area: "Pest Control", detail: "IPM specialist, 12yr exp", rating: 4.8, sessions: 215, next: "Today 5:30 PM", price: "Rs 250/hr", status: "Available" }
];

const servicesData: ServiceCard[] = [
  { id: "s1", title: "Tractor Ploughing Service", provider: "Harnam Farm Services", rating: 4.7, price: "Rs 1,200-Rs 2,000/day", status: "Available Now" },
  { id: "s2", title: "Paddy Transplanting Labor", provider: "Kisan Labor Co-op", rating: 4.5, price: "Rs 350-Rs 500/person/day", status: "Scheduled" }
];

const produceColors = ["#ff5f6d", "#f5cb3d", "#ffa64d", "#80d0a0", "#80b4ff", "#c7a0ff"];

export function MarketplaceScreen() {
  const [produceListings, setProduceListings] = useState<MarketplaceListing[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [section, setSection] = useState<MarketSection>("produce");
  const [subSection, setSubSection] = useState("All");

  useEffect(() => {
    let mounted = true;
    fetchMarketplaceListings()
      .then((data) => {
        if (!mounted) return;
        setProduceListings(data.listings);
      })
      .catch(() => {
        if (!mounted) return;
        setErrorMessage("Backend unavailable, showing fallback listings.");
        setProduceListings([
          { id: 1, cropName: "Tomato", district: "Nashik", pricePerKg: 28, verifiedOnly: true, listingType: "produce" },
          { id: 2, cropName: "Onion", district: "Nagpur", pricePerKg: 25, verifiedOnly: true, listingType: "produce" },
          { id: 3, cropName: "Soybean", district: "Indore", pricePerKg: 42, verifiedOnly: false, listingType: "produce" }
        ]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredProduce = useMemo(() => {
    const q = (activeTag ?? search).trim().toLowerCase();
    if (!q) return produceListings;
    return produceListings.filter((item) => item.cropName.toLowerCase().includes(q) || item.district.toLowerCase().includes(q));
  }, [produceListings, search, activeTag]);

  const switchSection = (next: MarketSection) => {
    setSection(next);
    setSubSection("All");
  };

  const countText =
    section === "produce"
      ? `${Math.max(filteredProduce.length, 15)} listings found`
      : section === "machinery"
        ? "6 machines found"
        : section === "knowledge"
          ? "5 experts found"
          : "5 services found";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.searchRow}>
        <Ionicons name="mic-outline" size={16} color="#60706c" />
        <TextInput
          placeholder="Search produce, machinery, courses..."
          placeholderTextColor="#80908b"
          style={styles.searchInput}
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            setActiveTag(null);
          }}
        />
        <Ionicons name="camera-outline" size={16} color="#60706c" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickTagsRow}>
        {quickTags.map((tag) => {
          const on = activeTag === tag;
          return (
            <Pressable key={tag} style={[styles.quickTag, on ? styles.quickTagActive : null]} onPress={() => setActiveTag(on ? null : tag)}>
              <Text style={[styles.quickTagText, on ? styles.quickTagTextActive : null]}>{tag}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topTabRow}>
        {topTabs.map((tab) => {
          const on = section === tab.id;
          return (
            <Pressable key={tab.id} style={styles.topTab} onPress={() => switchSection(tab.id)}>
              <View style={styles.topTabInner}>
                <Ionicons name={tab.icon} size={14} color={on ? "#0a9f46" : "#5d6d69"} />
                <Text style={[styles.topTabLabel, on ? styles.topTabLabelActive : null]}>{tab.label}</Text>
              </View>
              <View style={[styles.topTabUnderline, on ? styles.topTabUnderlineActive : null]} />
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.subRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabRow}>
          {subTabs[section].map((chip) => {
            const on = subSection === chip;
            return (
              <Pressable key={chip} style={[styles.subTab, on ? styles.subTabActive : null]} onPress={() => setSubSection(chip)}>
                <Text style={[styles.subTabText, on ? styles.subTabTextActive : null]}>{chip}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable style={styles.filterBtn}>
          <Ionicons name="funnel-outline" size={13} color="#5c6d69" />
          <Text style={styles.filterBtnText}>Filter</Text>
        </Pressable>
      </View>

      <Text style={styles.countText}>{countText}</Text>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {section === "produce" ? (
        <FlatList
          data={filteredProduce}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.produceGrid}
          renderItem={({ item, index }) => (
            <View style={[styles.produceCard, { backgroundColor: produceColors[index % produceColors.length] }]}>
              <View style={styles.verifyDot}><Ionicons name="checkmark" size={10} color="#fff" /></View>
              <View style={styles.produceFooter}>
                <Text style={styles.produceName}>{item.cropName}</Text>
                <Text style={styles.produceMeta}>{item.district}</Text>
                <Text style={styles.producePrice}>Rs {item.pricePerKg}/kg</Text>
              </View>
            </View>
          )}
        />
      ) : section === "machinery" ? (
        <ScrollView style={styles.listWrap} contentContainerStyle={styles.listBottom}>
          {machineData.map((m, idx) => (
            <View key={m.id} style={styles.detailCard}>
              <View style={[styles.heroStrip, { backgroundColor: idx % 2 === 0 ? "#ef4444" : "#ef7b4e" }]}>
                <Ionicons name="construct" size={24} color="#fff" />
              </View>
              <View style={styles.detailBody}>
                <View style={styles.rowBetween}><Text style={styles.title}>{m.title}</Text><Text style={styles.status}>{m.status}</Text></View>
                <Text style={styles.meta}>{m.owner} | {m.district}</Text>
                <Text style={styles.meta}>Rating {m.rating} | Verified 94</Text>
                <View style={styles.rowBetween}><Text style={styles.price}>{m.price}</Text><View /></View>
                <Pressable style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Book Now</Text></Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : section === "knowledge" ? (
        <ScrollView style={styles.listWrap} contentContainerStyle={styles.listBottom}>
          {knowledgeData.map((k) => (
            <View key={k.id} style={styles.detailCard}>
              <View style={styles.detailBody}>
                <View style={styles.rowBetween}><Text style={styles.title}>{k.name}</Text><Text style={styles.status}>{k.status}</Text></View>
                <Text style={styles.meta}>{k.area}</Text>
                <Text style={styles.meta}>{k.detail}</Text>
                <Text style={styles.meta}>Rating {k.rating} ({k.sessions} sessions)</Text>
                <View style={styles.rowBetween}><Text style={styles.meta}>Next {k.next}</Text><Text style={styles.price}>{k.price}</Text></View>
                <Pressable style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Book Consultation</Text></Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView style={styles.listWrap} contentContainerStyle={styles.listBottom}>
          {servicesData.map((s) => (
            <View key={s.id} style={styles.detailCard}>
              <View style={styles.detailBody}>
                <View style={styles.rowBetween}><Text style={styles.title}>{s.title}</Text><Text style={styles.status}>{s.status}</Text></View>
                <Text style={styles.meta}>{s.provider}</Text>
                <View style={styles.rowBetween}><Text style={styles.meta}>Rating {s.rating}</Text><Text style={styles.price}>{s.price}</Text></View>
                <Pressable style={styles.outlineBtn}><Text style={styles.outlineBtnText}>Request Service</Text></Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f7f5" },
  searchRow: {
    marginHorizontal: 8,
    marginTop: 6,
    marginBottom: 8,
    backgroundColor: "#f2efea",
    borderWidth: 1,
    borderColor: "#e5e2db",
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  searchInput: { flex: 1, fontSize: 13.5, paddingVertical: 9, color: "#263330" },
  quickTagsRow: { paddingHorizontal: 8, gap: 6, paddingBottom: 8 },
  quickTag: { borderRadius: 14, borderWidth: 1, borderColor: "#ddd8d1", backgroundColor: "#f4f1ec", paddingHorizontal: 10, paddingVertical: 5 },
  quickTagActive: { borderColor: "#0a9f46", backgroundColor: "#e8f5ee" },
  quickTagText: { fontSize: 11.5, color: "#707c79", fontWeight: "500" },
  quickTagTextActive: { color: "#0a9f46", fontWeight: "700" },
  topTabRow: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#dde4e1", backgroundColor: "#fff", paddingHorizontal: 2 },
  topTab: { paddingHorizontal: 8, paddingTop: 7 },
  topTabInner: { flexDirection: "row", alignItems: "center", gap: 4 },
  topTabLabel: { fontSize: 12.5, color: "#5d6d69", fontWeight: "600" },
  topTabLabelActive: { color: "#0a9f46" },
  topTabUnderline: { marginTop: 7, height: 2, backgroundColor: "transparent", borderRadius: 2 },
  topTabUnderlineActive: { backgroundColor: "#0a9f46" },
  subRowWrap: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#dde4e1", backgroundColor: "#fff" },
  subTabRow: { paddingHorizontal: 8, gap: 8, paddingVertical: 8, alignItems: "center" },
  subTab: { borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 16, backgroundColor: "#fafbfa", paddingHorizontal: 12, paddingVertical: 6 },
  subTabActive: { borderColor: "#0a9f46", backgroundColor: "#0a9f46" },
  subTabText: { fontSize: 12, color: "#52635e", fontWeight: "600" },
  subTabTextActive: { color: "#fff" },
  filterBtn: { marginLeft: "auto", marginRight: 10, borderWidth: 1, borderColor: "#d8dfdc", borderRadius: 16, backgroundColor: "#fafbfa", paddingHorizontal: 11, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  filterBtnText: { fontSize: 12, color: "#5b6b67", fontWeight: "600" },
  countText: { paddingHorizontal: 8, paddingVertical: 8, color: "#3f4f4b", fontSize: 13, fontWeight: "600" },
  errorText: { paddingHorizontal: 8, paddingBottom: 4, color: "#b45309", fontWeight: "600" },
  produceGrid: { paddingHorizontal: 6, paddingBottom: 106 },
  produceCard: { flex: 1, minHeight: 178, margin: 4, borderRadius: 12, overflow: "hidden" },
  verifyDot: { position: "absolute", right: 8, top: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: "#16a34a", alignItems: "center", justifyContent: "center" },
  produceFooter: { marginTop: "auto", backgroundColor: "rgba(255,255,255,0.88)", padding: 10 },
  produceName: { color: "#1f2c29", fontSize: 15.5, fontWeight: "700" },
  produceMeta: { color: "#5f6f6a", marginTop: 2, fontSize: 12 },
  producePrice: { color: "#0a9f46", marginTop: 4, fontWeight: "700", fontSize: 15 },
  listWrap: { flex: 1 },
  listBottom: { paddingHorizontal: 8, paddingBottom: 106 },
  detailCard: { borderWidth: 1, borderColor: "#d8e0dd", borderRadius: 12, backgroundColor: "#fff", marginBottom: 10, overflow: "hidden" },
  heroStrip: { height: 82, alignItems: "center", justifyContent: "center" },
  detailBody: { padding: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#1f2c29", fontWeight: "700", fontSize: 18 },
  status: { color: "#0a9f46", fontWeight: "700", fontSize: 11.5 },
  meta: { color: "#60706c", marginTop: 4, fontSize: 12.5 },
  price: { color: "#9a7a2f", marginTop: 4, fontSize: 17, fontWeight: "800" },
  primaryBtn: { marginTop: 10, backgroundColor: "#0a9f46", borderRadius: 8, alignItems: "center", paddingVertical: 10 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  outlineBtn: { marginTop: 10, borderWidth: 1, borderColor: "#0a9f46", borderRadius: 8, alignItems: "center", paddingVertical: 10 },
  outlineBtnText: { color: "#0a9f46", fontWeight: "700", fontSize: 13 }
});
