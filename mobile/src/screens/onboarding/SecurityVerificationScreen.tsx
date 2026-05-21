import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useLanguage } from "../../localization/LanguageContext";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

export function SecurityVerificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { completeSecurity } = useOnboarding();
  const { t } = useLanguage();

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
      title={t("securityVerificationTitle")}
      subtitle={t("securityVerificationSubtitle")}
      primaryLabel={t("completeVerificationDemo")}
      onPrimary={finish}
      showBack={false}
    >
      <View style={styles.block}>
        <Text style={styles.blockTitle}>{t("checksTitle")}</Text>
        <Text style={styles.item}>{t("checkFaceLiveness")}</Text>
        <Text style={styles.item}>{t("checkGovIdOcr")}</Text>
        <Text style={styles.item}>{t("checkVendorKyc")}</Text>
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
