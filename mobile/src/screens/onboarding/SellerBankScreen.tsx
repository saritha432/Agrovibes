import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

export function SellerBankScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { completeSellerStep } = useOnboarding();
  const [accountName, setAccountName] = React.useState("");
  const [ifsc, setIfsc] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");

  const next = async () => {
    await completeSellerStep("bank");
    navigation.navigate("SecurityVerification");
  };

  return (
    <OnboardingLayout
      title="Bank account"
      subtitle="Payouts for sold listings deposit here. Demo only — do not enter real banking data."
      primaryLabel="Continue to security"
      onPrimary={next}
      primaryDisabled={!accountName.trim() || ifsc.trim().length < 4 || accountNumber.replace(/\D/g, "").length < 6}
      onBack={() => navigation.goBack()}
    >
      <Text style={styles.label}>Account holder name</Text>
      <TextInput value={accountName} onChangeText={setAccountName} style={styles.input} />

      <Text style={styles.label}>IFSC</Text>
      <TextInput value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" style={styles.input} />

      <Text style={styles.label}>Account number</Text>
      <TextInput value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" style={styles.input} />
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
