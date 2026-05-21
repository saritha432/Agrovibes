import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useLanguage } from "../../localization/LanguageContext";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { APP_LIME } from "../../theme/appColors";

export function BuyerWalkthroughScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { completeBuyerStep } = useOnboarding();
  const { t } = useLanguage();

  const nudges = [t("buyerWalkthroughNudge1"), t("buyerWalkthroughNudge2"), t("buyerWalkthroughNudge3")];

  const next = async () => {
    await completeBuyerStep("walkthrough");
    navigation.navigate("SecurityVerification");
  };

  return (
    <OnboardingLayout
      title={t("buyerWalkthroughTitle")}
      subtitle={t("buyerWalkthroughSubtitle")}
      primaryLabel={t("continueToSecurity")}
      onPrimary={next}
      onBack={() => navigation.goBack()}
    >
      {nudges.map((line, i) => (
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
    color: APP_LIME,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 26,
    fontSize: 13
  },
  line: { flex: 1, fontWeight: "600", color: "#374641", fontSize: 14, lineHeight: 20 }
});
