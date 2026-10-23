import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ProviderChromeHeader } from "./ProviderChrome";
import { useAuth } from "../../../auth/AuthContext";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../../theme/appColors";
import {
  getProviderListings,
  syncProviderListingsFromApi,
  syncProviderRegistrationFromApi,
  type ProviderApprovalStatus,
  type ProviderListingRecord
} from "../../../services/providerWorkflow";

const BG = "#303132";
const CARD = "#373838";

function listingStatusLabel(status: ProviderListingRecord["status"]) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Waiting for admin approval";
}

export function ProviderListingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { token } = useAuth();
  const [registrationStatus, setRegistrationStatus] = useState<ProviderApprovalStatus>("not_submitted");
  const [listings, setListings] = useState<ProviderListingRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        const synced = await syncProviderRegistrationFromApi(token);
        const nextListings = await syncProviderListingsFromApi(token).catch(() => getProviderListings());
        if (!active) return;
        setRegistrationStatus(synced);
        setListings(nextListings);
      };
      void load();
      return () => {
        active = false;
      };
    }, [token])
  );

  return (
    <View style={styles.screen}>
      <ProviderChromeHeader />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Your listings</Text>
        <Text style={styles.sub}>Create a rental, service, store, or educator listing.</Text>
        {registrationStatus !== "approved" ? (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingTitle}>
              {registrationStatus === "rejected"
                ? "Registration Rejected"
                : registrationStatus === "pending"
                  ? "Registration Approval Pending"
                  : "Complete Registration"}
            </Text>
            <Text style={styles.pendingSub}>
              {registrationStatus === "rejected"
                ? "Admin rejected your KYC. Verify Aadhaar again. A business also needs PAN or GST."
                : "Admin review is required before your listings go live to customers."}
            </Text>
          </View>
        ) : null}
        {listings.map((listing) => (
          <View key={listing.id} style={styles.listingCard}>
            <Text style={styles.listingTitle}>{listing.title}</Text>
            <Text style={styles.listingMeta}>
              {listing.category} · {listing.channel}
            </Text>
            <Text style={styles.listingStatus}>{listingStatusLabel(listing.status)}</Text>
          </View>
        ))}
        <Pressable
          style={styles.cta}
          onPress={() => navigation.navigate("ProviderNewListing")}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={22} color="#000" />
          <Text style={styles.ctaText}>New Listing</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  body: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 120
  },
  title: { color: APP_LIME, fontSize: 22, fontWeight: "800" },
  sub: {
    color: APP_TEXT_MUTED,
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 18
  },
  pendingCard: {
    width: "100%",
    maxWidth: 398,
    marginBottom: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.35)",
    backgroundColor: "rgba(0,0,0,0.25)"
  },
  pendingTitle: { color: APP_LIME, fontSize: 13, fontWeight: "700", marginBottom: 4 },
  pendingSub: { color: APP_TEXT_MUTED, fontSize: 12, lineHeight: 17 },
  listingCard: {
    width: "100%",
    maxWidth: 398,
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12
  },
  listingTitle: { color: APP_TEXT, fontSize: 16, fontWeight: "800" },
  listingMeta: { color: APP_TEXT_MUTED, fontSize: 12, marginTop: 4 },
  listingStatus: { color: APP_LIME, fontSize: 12, fontWeight: "700", marginTop: 8 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: APP_LIME,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  ctaText: { color: "#000", fontSize: 15, fontWeight: "800" }
});
