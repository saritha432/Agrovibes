import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

export function SellerFarmScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { completeSellerStep } = useOnboarding();
  const [farmName, setFarmName] = React.useState("");
  const [acres, setAcres] = React.useState("");
  const [primaryCrop, setPrimaryCrop] = React.useState("");

  const next = async () => {
    await completeSellerStep("farm");
    navigation.navigate("SellerKYC");
  };

  return (
    <OnboardingLayout
      title="Farm details"
      subtitle="Tell buyers who you are. You can refine this on your seller profile later."
      primaryLabel="Continue"
      onPrimary={next}
      primaryDisabled={!farmName.trim() || !primaryCrop.trim()}
      onBack={() => navigation.navigate("RoleSelection")}
    >
      <Text style={styles.label}>Farm or business name</Text>
      <TextInput value={farmName} onChangeText={setFarmName} style={styles.input} />

      <Text style={styles.label}>Land under cultivation (acres, optional)</Text>
      <TextInput value={acres} onChangeText={setAcres} keyboardType="decimal-pad" style={styles.input} placeholder="e.g. 12.5" />

      <Text style={styles.label}>Primary crop or product</Text>
      <TextInput value={primaryCrop} onChangeText={setPrimaryCrop} style={styles.input} placeholder="e.g. Basmati, dairy, nursery" />
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
