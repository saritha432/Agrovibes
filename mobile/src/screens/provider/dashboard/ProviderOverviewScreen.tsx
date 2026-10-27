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
  const [hasRc, setHasRc] = useState(false);

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
        setHasRc(listings.some((row) => Boolean(row.rcNumber)));
      };
      void load();
      return () => {
        active = false;
      };
    }, [token])
  );

  const identityReady = Boolean(draft?.phoneOtpVerified && draft?.digilockerVerified);
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

  const steps: Step[] = [
    {
      title: "Provider registration",
      detail: "Mobile OTP, then DigiLocker Aadhaar.",
      done: identityReady,
      action: identityReady ? undefined : openRegistration
    },
    {
      title: "Business registration",
      detail: draft?.registrationType === "business" ? "PAN or GST, as applicable." : "Not required for an individual.",
      done: businessReady,
      action: draft?.registrationType === "business" && !businessReady ? openRegistration : undefined
    },
    {
      title: "Admin approval",
      detail: status === "approved" ? "KYC approved." : status === "rejected" ? "KYC was rejected." : status === "pending" ? "Waiting for admin review." : "Submit identity for review.",
      done: approved,
      action: !approved && identityReady && businessReady ? openRegistration : undefined
    },
    {
      title: "Add tractor",
      detail: hasRc ? "RC submitted for review." : "Tractor details and RC number.",
      done: hasRc,
      action: approved && !hasRc ? () => navigation.navigate("ProviderTractor") : undefined
    },
    {
      title: "Activate online bookings",
      detail: "Bank account, IFSC, and account holder verification.",
      done: bankReady,
      action: approved && hasRc && !bankReady ? () => navigation.navigate("ProviderBankDetails", { purpose: "payouts" }) : undefined
    },
    {
      title: "Receive payments",
      detail: payoutReady ? "Razorpay account linked." : "Razorpay linked account, after the bank is verified.",
      done: payoutReady,
      action: bankReady && !payoutReady ? () => navigation.navigate("ProviderPayouts") : undefined
    }
  ];

  return (
    <View style={styles.screen}>
      <ProviderChromeHeader />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Provider setup</Text>
        <Text style={styles.sub}>Finish each step in order. A later step stays closed until the one before it is done.</Text>
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
