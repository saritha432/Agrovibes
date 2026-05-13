import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

const NUDGES = [
  "Pull down on Home to refresh your feed.",
  "Use the + tab to post a harvest story or question.",
  "Verified badges on listings mean the seller passed basic checks."
];

export function BuyerWalkthroughScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { completeBuyerStep } = useOnboarding();

  const next = async () => {
    await completeBuyerStep("walkthrough");
    navigation.navigate("SecurityVerification");
  };

  return (
    <OnboardingLayout
      title="Quick tips"
      subtitle="A short walk-through — we'll remind you inside the app with gentle nudges."
      primaryLabel="Continue to security"
      onPrimary={next}
      onBack={() => navigation.goBack()}
    >
      {NUDGES.map((line, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.bullet}>{i + 1}</Text>
          <Text style={styles.line}>{line}</Text>
        </View>
      ))}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "flex-start" },
  bullet: {
    width: 26,
    height: 26,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#eef8f1",
    color: "#0a9f46",
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 26,
    fontSize: 13
  },
  line: { flex: 1, fontWeight: "600", color: "#374641", fontSize: 14, lineHeight: 20 }
});
