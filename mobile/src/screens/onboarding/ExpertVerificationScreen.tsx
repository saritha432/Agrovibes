import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useLanguage } from "../../localization/LanguageContext";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { APP_LIME } from "../../theme/appColors";

export function ExpertVerificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { completeExpertStep } = useOnboarding();
  const { t } = useLanguage();

  const next = async () => {
    await completeExpertStep("verification");
    navigation.navigate("SecurityVerification");
  };

  return (
    <OnboardingLayout
      title={t("expertVerificationTitle")}
      subtitle={t("expertVerificationSubtitle")}
      primaryLabel={t("submitForReviewDemo")}
      onPrimary={next}
      onBack={() => navigation.goBack()}
    >
      <View style={styles.callout}>
        <Text style={styles.calloutTitle}>{t("whatHappensNext")}</Text>
        <Text style={styles.calloutBody}>{t("expertVerificationBody")}</Text>
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
  calloutTitle: { fontWeight: "900", color: APP_LIME, marginBottom: 8 },
  calloutBody: { fontWeight: "600", color: "#4a5753", fontSize: 13, lineHeight: 19 }
});
