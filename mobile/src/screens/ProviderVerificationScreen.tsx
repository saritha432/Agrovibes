import React, { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { APP_LIME } from "../theme/appColors";
import { submitProviderRegistrationForApproval } from "../services/providerWorkflow";
import {
  PROVIDER_CARD,
  PROVIDER_MUTED,
  PROVIDER_TEXT,
  ProviderContinueButton,
  ProviderFormHeader,
  ProviderStepBar,
  providerFormStyles as pf
} from "./provider/providerFormUi";

export function ProviderVerificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { token } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const goToProviderDashboard = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "ProviderMain" }]
      })
    );
  };

  const onSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitProviderRegistrationForApproval(token);
      const message =
        "Admin has been notified. Your KYC will appear in Admin → KYC Verification for approval.";
      if (Platform.OS === "web") {
        window.alert(`Submitted For Approval\n\n${message}`);
        goToProviderDashboard();
      } else {
        Alert.alert("Submitted For Approval", message, [
          { text: "OK", onPress: goToProviderDashboard }
        ]);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Could not submit KYC. Please try again.";
      if (Platform.OS === "web") {
        window.alert(`Submission failed\n\n${errMsg}`);
      } else {
        Alert.alert("Submission failed", errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={pf.screen} edges={["top", "bottom"]}>
      <ProviderFormHeader onBack={() => navigation.goBack()} />
      <ProviderStepBar currentStep={4} />

      <ScrollView style={pf.scroll} contentContainerStyle={pf.content}>
        <Text style={styles.title}>Verification</Text>
        <Text style={styles.sub}>Review and submit your provider application</Text>

        <View style={styles.card}>
          <Ionicons name="shield-checkmark-outline" size={36} color={APP_LIME} />
          <Text style={styles.cardTitle}>Documents ready for review</Text>
          <Text style={styles.cardBody}>
            Our team will verify your KYC documents and activate your rental listing. This usually
            takes 1–2 business days.
          </Text>
        </View>
      </ScrollView>

      <ProviderContinueButton
        label={submitting ? "Submitting..." : "Submit for Review"}
        onPress={() => {
          void onSubmit();
        }}
        disabled={submitting}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: {
    color: APP_LIME,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 6
  },
  sub: {
    color: PROVIDER_MUTED,
    fontSize: 13,
    marginBottom: 18
  },
  card: {
    backgroundColor: PROVIDER_CARD,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.25)",
    alignItems: "center",
    gap: 10
  },
  cardTitle: {
    color: PROVIDER_TEXT,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center"
  },
  cardBody: {
    color: PROVIDER_MUTED,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center"
  }
});
