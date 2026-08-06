import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ProviderChromeHeader } from "./ProviderChrome";
import { useAuth } from "../../../auth/AuthContext";
import { APP_LIME, APP_TEXT_MUTED } from "../../../theme/appColors";
import {
  getProviderRegistrationStatus,
  processAdminApprovals,
  syncProviderRegistrationFromApi,
  type ProviderApprovalStatus
} from "../../../services/providerWorkflow";

const BG = "#303132";

export function ProviderListingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { token } = useAuth();
  const [registrationStatus, setRegistrationStatus] = useState<ProviderApprovalStatus>("not_submitted");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        await processAdminApprovals();
        const synced = await syncProviderRegistrationFromApi(token);
        const status = synced || (await getProviderRegistrationStatus());
        if (active) setRegistrationStatus(status);
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
      <View style={styles.body}>
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
                ? "Admin rejected your KYC. Update documents and submit again."
                : "Admin review is required before your listings go live to customers."}
            </Text>
          </View>
        ) : null}
        <Pressable
          style={styles.cta}
          onPress={() => navigation.navigate("ProviderNewListing")}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={22} color="#000" />
          <Text style={styles.ctaText}>New Listing</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 100
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
