import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { AppTopBar } from "../../components/AppTopBar";
import { navigateToRentalCategory } from "../../navigation/navigationRef";
import { useAndroidTabBackToHome } from "../../navigation/useAndroidScreenBack";
import { useAuth } from "../../auth/AuthContext";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";
import { getCustomerRentalBookings, uploadCustomerBookings, type CustomerRentalBooking } from "./customerRentalBookings";
import { RENTAL_CATEGORIES, RENTAL_LOCATIONS, type RentalLocation } from "./rentalCategories";

export function RentalBookingsPortalScreen() {
  useAndroidTabBackToHome();
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const [location, setLocation] = useState<RentalLocation>("Telangana");
  const [locationOpen, setLocationOpen] = useState(false);
  const [bookings, setBookings] = useState<CustomerRentalBooking[]>([]);
  const tileWidth = Math.floor((Math.min(width, 520) - 40 - 12) / 2);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void uploadCustomerBookings(token)
        .catch(() => undefined)
        .then(() => getCustomerRentalBookings())
        .then((mine) => {
          if (active) setBookings(mine);
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
        <Pressable
          style={styles.locationBtn}
          onPress={() => setLocationOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Location ${location}`}
        >
          <Text style={styles.locationKicker}>Location</Text>
          <Text style={styles.locationHint}>Current location</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={16} color={APP_LIME} />
            <Text style={styles.locationValue}>{location.toUpperCase()}</Text>
            <Ionicons name="chevron-down" size={16} color={APP_TEXT} />
          </View>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroKicker}>Rental bookings</Text>
          <Text style={styles.heroTitle}>Find a tractor and book it</Text>
          <Text style={styles.heroSub}>
            Check machinery, operators, drone spray, and field crews available in {location}.
          </Text>
        </View>

        {bookings.length > 0 ? (
          <View style={styles.listingsBlock}>
            <Text style={styles.listingsTitle}>Your requests</Text>
            {bookings.map((booking) => (
              <View key={booking.id} style={styles.requestCard}>
                <Text style={styles.requestTitle}>{booking.title}</Text>
                <Text style={styles.requestMeta}>
                  {booking.date} · {booking.location}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

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
                <Ionicons name={item.icon} size={42} color={APP_LIME} />
              </View>
              <Text style={styles.tileLabel}>{item.title}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal visible={locationOpen} transparent animationType="fade" onRequestClose={() => setLocationOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLocationOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Choose location</Text>
            {RENTAL_LOCATIONS.map((item) => {
              const selected = item === location;
              return (
                <Pressable
                  key={item}
                  style={styles.sheetRow}
                  onPress={() => {
                    setLocation(item);
                    setLocationOpen(false);
                  }}
                >
                  <Text style={[styles.sheetLabel, selected ? styles.sheetLabelOn : null]}>{item}</Text>
                  {selected ? <Ionicons name="checkmark" size={18} color={APP_LIME} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BLACK },
  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
  locationBtn: { alignSelf: "flex-start", marginBottom: 16 },
  locationKicker: { color: APP_TEXT, fontSize: 13, fontWeight: "800", marginBottom: 2 },
  locationHint: { color: APP_TEXT_MUTED, fontSize: 12, marginBottom: 2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationValue: { color: APP_TEXT, fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
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
    justifyContent: "center"
  },
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
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)"
  },
  sheetLabel: { color: APP_TEXT, fontSize: 16 },
  sheetLabelOn: { color: APP_LIME, fontWeight: "700" }
});
