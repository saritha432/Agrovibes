import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

export function ExpertVerificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { completeExpertStep } = useOnboarding();

  const next = async () => {
    await completeExpertStep("verification");
    navigation.navigate("SecurityVerification");
  };

  return (
    <OnboardingLayout
      title="Expert verification"
      subtitle="We review credentials and sample content before badges go live. This demo marks the step complete when you continue."
      primaryLabel="Submit for review (demo)"
      onPrimary={next}
      onBack={() => navigation.goBack()}
    >
      <View style={styles.callout}>
        <Text style={styles.calloutTitle}>What happens next</Text>
        <Text style={styles.calloutBody}>
          Production: upload a short teaching clip, references, and optional ID. Our team typically responds within 48 hours.
        </Text>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  callout: {
    backgroundColor: "#f6faf7",
    borderWidth: 1,
    borderColor: "#cde9d9",
    borderRadius: 14,
    padding: 14
  },
  calloutTitle: { fontWeight: "900", color: "#0f3d2e", marginBottom: 8 },
  calloutBody: { fontWeight: "600", color: "#4a5753", fontSize: 13, lineHeight: 19 }
});
