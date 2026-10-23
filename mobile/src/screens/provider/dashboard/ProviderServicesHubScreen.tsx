import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ProviderChromeHeader, ProviderEmptyState } from "./ProviderChrome";
import { useAuth } from "../../../auth/AuthContext";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../../theme/appColors";
import {
  getProviderListings,
  uploadLocalListings,
  type ProviderListingRecord
} from "../../../services/providerWorkflow";

const BG = "#303132";
const CARD = "#373838";

export function ProviderServicesHubScreen() {
  const { token } = useAuth();
  const [listings, setListings] = useState<ProviderListingRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        const rows = await uploadLocalListings(token).catch(() => getProviderListings());
        if (!active) return;
        setListings(rows.filter((row) => row.channel === "Services"));
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
      {listings.length === 0 ? (
        <ProviderEmptyState title="Services" subtitle="Service listings you publish will appear here." />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {listings.map((listing) => (
            <View key={listing.id} style={styles.card}>
              <Text style={styles.title}>{listing.title}</Text>
              <Text style={styles.meta}>{listing.category}</Text>
              <Text style={styles.status}>
                {listing.status === "approved" ? "Approved" : "Waiting for admin approval"}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  list: { padding: 16, paddingBottom: 120, gap: 12 },
  card: { backgroundColor: CARD, borderRadius: 12, padding: 14 },
  title: { color: APP_TEXT, fontSize: 16, fontWeight: "800" },
  meta: { color: APP_TEXT_MUTED, fontSize: 12, marginTop: 4 },
  status: { color: APP_LIME, fontSize: 12, fontWeight: "700", marginTop: 8 }
});
