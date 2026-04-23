import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

export function SellerKycScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { completeSellerStep } = useOnboarding();
  const [legalName, setLegalName] = React.useState("");
  const [idLast4, setIdLast4] = React.useState("");

  const next = async () => {
    await completeSellerStep("kyc");
    navigation.navigate("SellerBank");
  };

  return (
    <OnboardingLayout
      title="KYC basics"
      subtitle="Demo step — production would capture ID document OCR and match your name."
      primaryLabel="Continue"
      onPrimary={next}
      primaryDisabled={!legalName.trim() || idLast4.replace(/\D/g, "").length < 4}
      onBack={() => navigation.goBack()}
    >
      <Text style={styles.label}>Legal name (as on ID)</Text>
      <TextInput value={legalName} onChangeText={setLegalName} style={styles.input} />

      <Text style={styles.label}>Last 4 digits of Aadhaar / ID reference</Text>
      <TextInput
        value={idLast4}
        onChangeText={setIdLast4}
        keyboardType="number-pad"
        maxLength={4}
        style={styles.input}
        placeholder="••••"
      />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 10, fontWeight: "900", color: "#22312d" },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#dce3e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "700",
    color: "#111616"
  }
});
