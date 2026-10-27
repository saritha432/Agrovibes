import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { RentalText as Text, RentalTextInput as TextInput, rentalType } from "./rentalTypography";
import { LocationMapPicker } from "../../components/LocationMapPicker";
import { navigateToRentalCart, navigateToRentalCategory } from "../../navigation/navigationRef";
import { useAndroidTabBackToHome } from "../../navigation/useAndroidScreenBack";
import { useAuth } from "../../auth/AuthContext";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED, APP_TEXT_ON_LIME } from "../../theme/appColors";
import { useTopChromeInset } from "../../theme/topChromeInset";
import { uploadCustomerBookings } from "./customerRentalBookings";
import { RENTAL_CATEGORIES } from "./rentalCategories";
import { RENTAL_CATALOG_SUBS } from "./rentalCatalog";
import { useUserLocation } from "../../location/UserLocationContext";
import { useRentalCart } from "./RentalCartContext";

const FEATURED = ["machinery", "drone", "labour", "soil"];
const LOGO = require("../../../assets/crop vibe.png");
const HERO_ART = RENTAL_CATALOG_SUBS.machinery[0].image;

export function RentalBookingsPortalScreen() {
  useAndroidTabBackToHome();
  const { token } = useAuth();
  const topInset = useTopChromeInset();
  const { width } = useWindowDimensions();
  const { label: location, lat: locationLat, lng: locationLng, saveLocation, refreshLocation } = useUserLocation();
  const [locationOpen, setLocationOpen] = useState(false);
  const [mapMode, setMapMode] = useState<"current" | "manual" | null>(null);
  const { itemCount: cartCount, refreshFromServer } = useRentalCart();
  const [query, setQuery] = useState("");
  const pageWidth = Math.min(width, 430);
  const tileWidth = Math.floor((pageWidth - 32 - 12) / 2);

  useFocusEffect(
    useCallback(() => {
      void uploadCustomerBookings(token).catch(() => undefined);
      void refreshFromServer();
      void refreshLocation().catch(() => undefined);
    }, [token, refreshFromServer, refreshLocation])
  );

  const categories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = needle
      ? RENTAL_CATEGORIES.filter((item) => `${item.title} ${item.blurb}`.toLowerCase().includes(needle))
      : RENTAL_CATEGORIES.filter((item) => FEATURED.includes(item.id));
    return [...source].sort((a, b) => {
      const rank = (id: string) => {
        const index = FEATURED.indexOf(id);
        return index === -1 ? FEATURED.length : index;
      };
      return rank(a.id) - rank(b.id);
    });
  }, [query]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: topInset + 8 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Pressable style={styles.cartBtn} onPress={() => navigateToRentalCart(location)} accessibilityLabel="Cart">
            <Ionicons name="cart-outline" size={26} color={APP_TEXT} />
            {cartCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Pressable
          style={styles.locationBtn}
          onPress={() => setLocationOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Location ${location}`}
        >
          <Text style={styles.locationKicker}>Your location</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={16} color={APP_LIME} />
            <Text style={styles.locationValue} numberOfLines={1} ellipsizeMode="tail">
              {location}
            </Text>
            <Ionicons name="chevron-down" size={16} color={APP_TEXT_MUTED} />
          </View>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>Rental bookings</Text>
            <Text style={styles.heroTitle}>Ready for your next big job?</Text>
            <Text style={styles.heroSub}>Find the right machinery for your farm.</Text>
            <Pressable style={styles.heroBtn} onPress={() => navigateToRentalCategory("machinery", location)}>
              <Text style={styles.heroBtnText}>Explore rentals</Text>
              <Ionicons name="arrow-forward" size={14} color="#f4fff4" />
            </Pressable>
          </View>
          <Image source={HERO_ART} style={styles.heroArt} resizeMode="contain" />
        </View>

        <Text style={styles.ask}>What do you need today?</Text>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color="#8d8d8d" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search tractors, drones, labour..."
            placeholderTextColor="#8d8d8d"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Explore categories</Text>
          <Pressable onPress={() => navigateToRentalCategory("all", location)} hitSlop={8}>
            <Text style={styles.viewAll}>View all →</Text>
          </Pressable>
        </View>

        {categories.length === 0 ? <Text style={styles.empty}>No rentals match that search.</Text> : null}
        <View style={styles.grid}>
          {categories.map((item) => {
            const photo = RENTAL_CATALOG_SUBS[item.id]?.[0]?.image;
            return (
              <Pressable
                key={item.id}
                style={[styles.tile, { width: tileWidth }]}
                onPress={() => navigateToRentalCategory(item.id, location)}
                accessibilityRole="button"
                accessibilityLabel={item.title}
              >
                {photo ? <Image source={photo} style={styles.tileImage} resizeMode="cover" /> : <View style={styles.tileImage} />}
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.72)"]} style={styles.tileShade} />
                <Text style={styles.tileLabel} numberOfLines={2}>
                  {item.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={locationOpen} transparent animationType="fade" onRequestClose={() => setLocationOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLocationOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Where do you need it?</Text>
            <Pressable
              style={styles.sheetRow}
              onPress={() => {
                setLocationOpen(false);
                setMapMode("current");
              }}
            >
              <Ionicons name="navigate" size={18} color={APP_LIME} />
              <Text style={styles.sheetLabel}>Use current location</Text>
            </Pressable>
            <Pressable
              style={styles.sheetRow}
              onPress={() => {
                setLocationOpen(false);
                setMapMode("manual");
              }}
            >
              <Ionicons name="map-outline" size={18} color={APP_LIME} />
              <Text style={styles.sheetLabel}>Add manually on the map</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <LocationMapPicker
        open={mapMode !== null}
        mode={mapMode || "auto"}
        label={location === "Add location" ? "" : location}
        lat={locationLat}
        lng={locationLng}
        onClose={() => setMapMode(null)}
        onSelect={(value) => {
          void saveLocation({ label: value.label, lat: value.lat, lng: value.lng }).catch(() => undefined);
          setMapMode(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#121212" },
  body: { paddingHorizontal: 16, paddingBottom: 28, width: "100%", maxWidth: 430, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  logo: { width: 132, height: 28 },
  cartBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  cartBadge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3
  },
  cartBadgeText: { color: APP_TEXT_ON_LIME, ...rentalType(10, "800") },
  locationBtn: { marginBottom: 14 },
  locationKicker: {
    color: APP_TEXT_MUTED,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
    ...rentalType(11, "700")
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationValue: { color: APP_TEXT, flex: 1, minWidth: 0, flexShrink: 1, ...rentalType(16, "800") },
  hero: {
    minHeight: 168,
    borderRadius: 18,
    backgroundColor: "#143322",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingLeft: 16
  },
  heroCopy: { flex: 1, paddingVertical: 16, zIndex: 1 },
  heroKicker: {
    color: "#d7e7c8",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    ...rentalType(11, "800")
  },
  heroTitle: { color: "#f4fff4", marginTop: 8, ...rentalType(22, "800", { lineHeight: 28 }) },
  heroSub: { color: "#d7e7c8", marginTop: 6, ...rentalType(13, "400", { lineHeight: 18 }) },
  heroBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    backgroundColor: "#2f6b45",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  heroBtnText: { color: "#f4fff4", ...rentalType(13, "800") },
  heroArt: { width: 132, height: 150, marginRight: 4 },
  ask: { color: APP_TEXT, marginBottom: 10, ...rentalType(16, "800") },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 18
  },
  searchInput: { flex: 1, color: "#1a1a1a", paddingVertical: 12, ...rentalType(15, "400") },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: APP_TEXT, ...rentalType(18, "800") },
  viewAll: { color: APP_LIME, ...rentalType(14, "700") },
  empty: { color: APP_TEXT_MUTED, marginBottom: 12, ...rentalType(14, "400") },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { height: 156, borderRadius: 16, overflow: "hidden", backgroundColor: "#1c1c1c", justifyContent: "flex-end" },
  tileImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  tileShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 72 },
  tileLabel: {
    color: "#ffffff",
    paddingHorizontal: 12,
    paddingBottom: 12,
    ...rentalType(15, "800", { lineHeight: 20 })
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#1c1c1c",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28
  },
  sheetTitle: { color: APP_TEXT, marginBottom: 8, ...rentalType(16, "800") },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)"
  },
  sheetLabel: { color: APP_TEXT, ...rentalType(16, "400") }
});
