import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useLanguage } from "../../localization/LanguageContext";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

export function SellerFarmScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { completeSellerStep } = useOnboarding();
  const { t } = useLanguage();
  const [farmName, setFarmName] = React.useState("");
  const [acres, setAcres] = React.useState("");
  const [primaryCrop, setPrimaryCrop] = React.useState("");

  const next = async () => {
    await completeSellerStep("farm");
    navigation.navigate("SellerKYC");
  };

  return (
    <OnboardingLayout
      title={t("sellerFarmTitle")}
      subtitle={t("sellerFarmSubtitle")}
      primaryLabel={t("continue")}
      onPrimary={next}
      primaryDisabled={!farmName.trim() || !primaryCrop.trim()}
      onBack={() => navigation.navigate("RoleSelection")}
    >
      <Text style={styles.label}>{t("farmNameLabel")}</Text>
      <TextInput value={farmName} onChangeText={setFarmName} style={styles.input} />

      <Text style={styles.label}>{t("landAcresLabel")}</Text>
      <TextInput value={acres} onChangeText={setAcres} keyboardType="decimal-pad" style={styles.input} placeholder={t("acresPlaceholder")} />

      <Text style={styles.label}>{t("primaryCropLabel")}</Text>
      <TextInput value={primaryCrop} onChangeText={setPrimaryCrop} style={styles.input} placeholder={t("primaryCropPlaceholder")} />
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
