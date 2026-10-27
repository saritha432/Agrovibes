import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ImageSourcePropType } from "react-native";
import { AppTopBar } from "../../components/AppTopBar";
import { LocationMapPicker } from "../../components/LocationMapPicker";
import { navigateToRentalCart, navigateToRentalCategory } from "../../navigation/navigationRef";
import { useAndroidTabBackToHome } from "../../navigation/useAndroidScreenBack";
import { useAuth } from "../../auth/AuthContext";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED, APP_TEXT_ON_LIME } from "../../theme/appColors";
import { uploadCustomerBookings } from "./customerRentalBookings";
import { RENTAL_CATEGORIES } from "./rentalCategories";
import { RENTAL_CATALOG_SUBS } from "./rentalCatalog";
import { getRentalCart, type RentalCartLine } from "./rentalCart";

const BANNERS: Array<{ id: string; title: string; subtitle: string; image: ImageSourcePropType }> = [
  {
    id: "machinery",
    title: "Book a tractor",
    subtitle: "Machinery for the day",
    image: RENTAL_CATALOG_SUBS.machinery[0].image
  },
  {
    id: "drone",
    title: "Drone spray",
    subtitle: "A pilot for your field",
    image: RENTAL_CATALOG_SUBS.drone[0].image
  },
  {
    id: "drivers",
    title: "Hire an operator",
    subtitle: "Drivers ready for the shift",
    image: RENTAL_CATALOG_SUBS.drivers[0].image
  }
];

export function RentalBookingsPortalScreen() {
  useAndroidTabBackToHome();
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const [location, setLocation] = useState("Add location");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [mapMode, setMapMode] = useState<"current" | "manual" | null>(null);
  const [cart, setCart] = useState<RentalCartLine[]>([]);
  const tileWidth = Math.floor((Math.min(width, 520) - 40 - 12) / 2);
  const bannerWidth = Math.min(width, 520) - 72;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void uploadCustomerBookings(token).catch(() => undefined);
      void getRentalCart().then((lines) => {
        if (active) setCart(lines);
      });
      return () => {
        active = false;
      };
    }, [token])
  );

  return (
    <View style={styles.screen}>
      <AppTopBar />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.locationBar}>
          <Pressable
            style={styles.locationBtn}
            onPress={() => setLocationOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Location ${location}`}
          >
            <Text style={styles.locationKicker}>Location</Text>
            <Text style={styles.locationHint}>Current location or add it on the map</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={16} color={APP_LIME} />
              <Text style={styles.locationValue} numberOfLines={1}>
                {location}
              </Text>
              <Ionicons name="chevron-down" size={16} color={APP_TEXT} />
            </View>
          </Pressable>
          <Pressable style={styles.cartBtn} onPress={() => navigateToRentalCart(location)} accessibilityLabel="Cart">
            <Ionicons name="cart-outline" size={24} color={APP_TEXT} />
            {cart.length > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cart.reduce((sum, line) => sum + line.quantity, 0)}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bannerRow}>
          {BANNERS.map((banner) => (
            <Pressable
              key={banner.id}
              style={[styles.banner, { width: bannerWidth }]}
              onPress={() => navigateToRentalCategory(banner.id, location)}
            >
              <View style={styles.bannerText}>
                <Text style={styles.bannerKicker}>Rental bookings</Text>
                <Text style={styles.bannerTitle}>{banner.title}</Text>
                <Text style={styles.bannerSub}>{banner.subtitle}</Text>
              </View>
              <Image source={banner.image} style={styles.bannerArt} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Top categories</Text>
          <Pressable onPress={() => navigateToRentalCategory("all", location)} hitSlop={8}>
            <Text style={styles.viewAll}>View all</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          {RENTAL_CATEGORIES.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.tile, { width: tileWidth }]}
              onPress={() => navigateToRentalCategory(item.id, location)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <View style={[styles.tileArt, { backgroundColor: item.wash }]}>
                {RENTAL_CATALOG_SUBS[item.id]?.[0] ? (
                  <Image source={RENTAL_CATALOG_SUBS[item.id][0].image} style={styles.tileImage} resizeMode="cover" />
                ) : (
                  <Ionicons name={item.icon} size={42} color={APP_LIME} />
                )}
              </View>
              <Text style={styles.tileLabel}>{item.title}</Text>
            </Pressable>
          ))}
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
          setLocation(value.label);
          setLocationLat(value.lat);
          setLocationLng(value.lng);
          setMapMode(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BLACK },
  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
  locationBar: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  locationBtn: { flex: 1 },
  cartBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  cartBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3
  },
  cartBadgeText: { color: APP_TEXT_ON_LIME, fontSize: 10, fontWeight: "800" },
  bannerRow: { gap: 10, paddingBottom: 18 },
  banner: {
    height: 132,
    borderRadius: 16,
    backgroundColor: "#EDEDED",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center"
  },
  bannerText: { flex: 1, paddingLeft: 14 },
  bannerKicker: { color: "#3a3a3a", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  bannerTitle: { color: APP_BLACK, fontSize: 18, fontWeight: "800", marginTop: 4 },
  bannerSub: { color: "#3a3a3a", fontSize: 12, marginTop: 4 },
  bannerArt: { width: 120, height: "100%" },
  cartEmpty: { color: APP_TEXT_MUTED, paddingVertical: 12 },
  cartLine: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  cartLineBody: { flex: 1 },
  cartLineTitle: { color: APP_TEXT, fontSize: 15, fontWeight: "800" },
  cartLineMeta: { color: APP_TEXT_MUTED, fontSize: 12, marginTop: 2 },
  locationKicker: { color: APP_TEXT, fontSize: 13, fontWeight: "800", marginBottom: 2 },
  locationHint: { color: APP_TEXT_MUTED, fontSize: 12, marginBottom: 2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationValue: { color: APP_TEXT, fontSize: 16, fontWeight: "800", maxWidth: 240 },
  requestPlace: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  hero: {
    backgroundColor: APP_SURFACE,
    borderRadius: 18,
    padding: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.28)"
  },
  heroKicker: { color: APP_LIME, fontSize: 12, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  heroTitle: { color: APP_TEXT, fontSize: 24, fontWeight: "800", marginTop: 8, lineHeight: 30 },
  heroSub: { color: APP_TEXT_MUTED, fontSize: 14, lineHeight: 20, marginTop: 8 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  listingsBlock: { marginBottom: 18 },
  listingsTitle: { color: APP_TEXT, fontSize: 20, fontWeight: "800", marginBottom: 12 },
  sectionTitle: { color: APP_TEXT, fontSize: 20, fontWeight: "800" },
  viewAll: { color: APP_LIME, fontSize: 14, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { marginBottom: 4 },
  tileArt: {
    height: 132,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  tileImage: { width: "100%", height: "100%" },
  tileLabel: {
    color: APP_TEXT,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18
  },
  requestCard: {
    backgroundColor: APP_SURFACE,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10
  },
  requestTitle: { color: APP_TEXT, fontSize: 15, fontWeight: "800" },
  requestMeta: { color: APP_TEXT_MUTED, fontSize: 12, marginTop: 4 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: "#1c1c1c",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28
  },
  sheetTitle: { color: APP_TEXT, fontSize: 16, fontWeight: "800", marginBottom: 8 },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)"
  },
  sheetLabel: { color: APP_TEXT, fontSize: 16 },
  sheetLabelOn: { color: APP_LIME, fontWeight: "700" }
});
