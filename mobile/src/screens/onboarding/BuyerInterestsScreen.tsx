import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useLanguage } from "../../localization/LanguageContext";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

export function BuyerInterestsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { completeBuyerStep } = useOnboarding();
  const { t } = useLanguage();
  const [interests, setInterests] = React.useState("");

  const next = async () => {
    await completeBuyerStep("interests");
    navigation.navigate("BuyerDelivery");
  };

  return (
    <OnboardingLayout
      title={t("buyerInterestsTitle")}
      subtitle={t("buyerInterestsSubtitle")}
      primaryLabel={t("continue")}
      onPrimary={next}
      primaryDisabled={!interests.trim()}
      onBack={() => navigation.navigate("RoleSelection")}
    >
      <Text style={styles.label}>{t("interestsLabel")}</Text>
      <TextInput
        value={interests}
        onChangeText={setInterests}
        style={styles.input}
        multiline
        placeholder={t("interestsPlaceholder")}
        placeholderTextColor="#9aa9a5"
      />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: "900", color: "#22312d", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#dce3e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 100,
    textAlignVertical: "top",
    fontWeight: "600",
    color: "#111616"
  }
});
