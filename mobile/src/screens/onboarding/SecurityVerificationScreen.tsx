import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

export function SecurityVerificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { completeSecurity } = useOnboarding();

  const finish = async () => {
    await completeSecurity();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Main" }]
      })
    );
  };

  return (
    <OnboardingLayout
      title="Security verification"
      subtitle="Face liveness, ID OCR, and third-party KYC would plug in here. Tap below to simulate a successful check."
      primaryLabel="Complete verification (demo)"
      onPrimary={finish}
      showBack={false}
    >
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Checks</Text>
        <Text style={styles.item}>• Face liveness (anti-spoof)</Text>
        <Text style={styles.item}>• Government ID capture & OCR</Text>
        <Text style={styles.item}>• Optional vendor KYC match</Text>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 14,
    padding: 14
  },
  blockTitle: { fontWeight: "900", color: "#9a3412", marginBottom: 10 },
  item: { fontWeight: "600", color: "#7c2d12", fontSize: 13, lineHeight: 20, marginBottom: 4 }
});
