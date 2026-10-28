import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ProviderChromeHeader } from "./ProviderChrome";
import { useAuth } from "../../../auth/AuthContext";
import {
  getProviderListings,
  getProviderRegistrationDraft,
  syncProviderRegistrationFromApi,
  type ProviderApprovalStatus,
  type ProviderRegistrationDraft
} from "../../../services/providerWorkflow";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../../theme/appColors";

type Step = {
  title: string;
  detail: string;
  done: boolean;
  action?: () => void;
};

export function ProviderOverviewScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { token } = useAuth();
  const [status, setStatus] = useState<ProviderApprovalStatus>("not_submitted");
  const [draft, setDraft] = useState<ProviderRegistrationDraft | null>(null);
  const [approvedEquipment, setApprovedEquipment] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        const [nextStatus, nextDraft, listings] = await Promise.all([
          syncProviderRegistrationFromApi(token),
          getProviderRegistrationDraft(),
          getProviderListings()
        ]);
        if (!active) return;
        setStatus(nextStatus);
        setDraft(nextDraft);
        setApprovedEquipment(listings.filter((row) => row.status === "approved").length);
      };
      void load();
      return () => {
        active = false;
      };
    }, [token])
  );

  const businessReady = draft?.registrationType !== "business" || Boolean(draft?.panMatched || draft?.gstNumber);
  const approved = status === "approved";
  const bankReady = Boolean(draft?.bankVerified);
  const payoutReady = Boolean(draft?.razorpayAccountId);

  const openRegistration = () => {
    if (!draft?.phoneOtpVerified) {
      navigation.navigate("ProviderPersonalDetails", {
        track: draft?.track || "rental",
        registrationType: draft?.registrationType || "individual"
      });
      return;
    }
    if (!draft?.digilockerVerified) {
      navigation.navigate("ProviderKycVerification", {
        track: draft.track,
        registrationType: draft.registrationType
      });
      return;
    }
    if (draft.registrationType === "business" && !businessReady) {
      navigation.navigate("ProviderPanVerification", { track: draft.track, registrationType: "business" });
      return;
    }
    navigation.navigate("ProviderVerification", { track: draft.track, registrationType: draft.registrationType });
  };

  const bookingsOn = approved && bankReady && payoutReady && approvedEquipment > 0;
  const steps: Step[] = [
    {
      title: "Provider Registration",
      detail: "Individual / Business, then DigiLocker, then admin approval.",
      done: approved,
      action: approved ? undefined : openRegistration
    },
    {
      title: "Provider Dashboard Unlocked",
      detail: "Add tractors and other equipment.",
      done: approved,
      action: approved ? () => navigation.navigate("ProviderNewListing") : undefined
    },
    {
      title: "Add Bank Account (One Time)",
      detail: payoutReady ? "Bank verified and Razorpay account linked." : "Account number, IFSC, and account holder name.",
      done: payoutReady,
      action: !approved ? undefined : !bankReady ? () => navigation.navigate("ProviderBankDetails", { purpose: "payouts" }) : !payoutReady ? () => navigation.navigate("ProviderPayouts") : undefined
    },
    {
      title: "Online Bookings Enabled",
      detail: bookingsOn ? "Approved equipment can be booked online." : "Turns on after the bank, Razorpay, and equipment approval succeed.",
      done: bookingsOn
    }
  ];

  return (
    <View style={styles.screen}>
      <ProviderChromeHeader />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Provider setup</Text>
        <Text style={styles.sub}>Registration, then the dashboard. The bank account is added once on this dashboard.</Text>
        {steps.map((step, index) => {
          const locked = steps.slice(0, index).some((item) => !item.done);
          return (
            <Pressable
              key={step.title}
              style={styles.card}
              disabled={locked || !step.action}
              onPress={step.action}
            >
              <Ionicons name={!locked && step.done ? "checkmark-circle" : "ellipse-outline"} size={20} color={!locked && step.done ? APP_LIME : APP_TEXT_MUTED} />
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{step.title}</Text>
                <Text style={styles.cardDetail}>{locked ? "Complete the previous step first." : step.detail}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#303132" },
  body: { padding: 16, paddingBottom: 40 },
  title: { color: APP_LIME, fontSize: 24, fontWeight: "800" },
  sub: { color: APP_TEXT_MUTED, marginTop: 6, marginBottom: 14, lineHeight: 18 },
  card: { flexDirection: "row", gap: 10, backgroundColor: "#373838", borderRadius: 12, padding: 14, marginBottom: 10 },
  copy: { flex: 1 },
  cardTitle: { color: APP_TEXT, fontSize: 15, fontWeight: "800" },
  cardDetail: { color: APP_TEXT_MUTED, fontSize: 12, marginTop: 4, lineHeight: 17 }
});
