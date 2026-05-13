import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

export function ExpertDomainScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { completeExpertStep } = useOnboarding();
  const [topics, setTopics] = React.useState("");
  const [years, setYears] = React.useState("");

  const next = async () => {
    await completeExpertStep("domain");
    navigation.navigate("ExpertCredentials");
  };

  return (
    <OnboardingLayout
      title="Your domain"
      subtitle="What topics or crops do you advise on? Shown on your expert profile."
      primaryLabel="Continue"
      onPrimary={next}
      primaryDisabled={!topics.trim()}
      onBack={() => navigation.navigate("RoleSelection")}
    >
      <Text style={styles.label}>Specializations</Text>
      <TextInput
        value={topics}
        onChangeText={setTopics}
        style={[styles.input, styles.inputTall]}
        multiline
        placeholder="e.g. Soil health, polyhouse tomatoes, organic certification"
        placeholderTextColor="#9aa9a5"
      />

      <Text style={styles.label}>Years of experience (optional)</Text>
      <TextInput
        value={years}
        onChangeText={setYears}
        keyboardType="number-pad"
        style={styles.input}
        placeholder="e.g. 8"
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
  inputTall: { minHeight: 88, textAlignVertical: "top" }
});
