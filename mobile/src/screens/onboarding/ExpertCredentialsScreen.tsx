import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

export function ExpertCredentialsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { completeExpertStep } = useOnboarding();
  const [headline, setHeadline] = React.useState("");
  const [certs, setCerts] = React.useState("");

  const next = async () => {
    await completeExpertStep("credentials");
    navigation.navigate("ExpertVerification");
  };

  return (
    <OnboardingLayout
      title="Credentials"
      subtitle="Degrees, certifications, or institutional affiliations learners should know about."
      primaryLabel="Continue"
      onPrimary={next}
      primaryDisabled={!headline.trim()}
      onBack={() => navigation.goBack()}
    >
      <Text style={styles.label}>Professional headline</Text>
      <TextInput
        value={headline}
        onChangeText={setHeadline}
        style={styles.input}
        placeholder="e.g. Agronomist, KVK extension officer"
      />

      <Text style={styles.label}>Certifications (optional)</Text>
      <TextInput
        value={certs}
        onChangeText={setCerts}
        style={[styles.input, styles.tall]}
        multiline
        placeholder="B.Sc. Ag, Certificate in organic inspection…"
        placeholderTextColor="#9aa9a5"
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
  },
  tall: { minHeight: 88, textAlignVertical: "top" }
});
