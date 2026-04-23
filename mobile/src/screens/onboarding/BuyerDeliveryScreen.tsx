import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

export function BuyerDeliveryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { completeBuyerStep } = useOnboarding();
  const [line1, setLine1] = React.useState("");
  const [district, setDistrict] = React.useState("");
  const [pin, setPin] = React.useState("");

  const next = async () => {
    await completeBuyerStep("delivery");
    navigation.navigate("BuyerWalkthrough");
  };

  return (
    <OnboardingLayout
      title="Delivery address"
      subtitle="Default drop-off for marketplace orders (you can add more later)."
      primaryLabel="Continue"
      onPrimary={next}
      primaryDisabled={!line1.trim() || !district.trim()}
      onBack={() => navigation.goBack()}
    >
      <Text style={styles.label}>Address line</Text>
      <TextInput value={line1} onChangeText={setLine1} style={styles.input} placeholder="Village, landmark, street" />

      <Text style={styles.label}>District</Text>
      <TextInput value={district} onChangeText={setDistrict} style={styles.input} />

      <Text style={styles.label}>PIN code (optional)</Text>
      <TextInput value={pin} onChangeText={setPin} keyboardType="number-pad" style={styles.input} maxLength={8} />
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
