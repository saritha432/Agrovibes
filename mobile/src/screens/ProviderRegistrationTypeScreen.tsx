import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";
import { updateProviderRegistrationDraft, type ProviderRegistrationType } from "../services/providerWorkflow";

const BG = "#1f1f1f";
const TEXT = APP_TEXT;
const MUTED = APP_TEXT_MUTED;

const TYPE_OPTIONS: Array<{ id: ProviderRegistrationType; title: string; subtitle: string }> = [
  {
    id: "individual",
    title: "Individual",
    subtitle: "Register as a person with Aadhaar and personal KYC documents."
  },
  {
    id: "business",
    title: "Business / Company",
    subtitle: "Register as a firm or company with business details and documents."
  }
];

export function ProviderRegistrationTypeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const track = route.params?.track === "service" || route.params?.track === "both" ? route.params.track : "rental";
  const [selectedType, setSelectedType] = useState<ProviderRegistrationType>("individual");

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={APP_LIME} />
        </Pressable>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>
          Registration <Text style={styles.titleAccent}>Type</Text>
        </Text>
        <Text style={styles.subtitle}>
          Are you registering as an individual or as a business / company?
        </Text>
      </View>

      <View style={styles.optionsWrap}>
        {TYPE_OPTIONS.map((option) => {
          const active = selectedType === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setSelectedType(option.id)}
              style={[styles.optionCard, active && styles.optionCardActive]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{option.title}</Text>
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={styles.continueBtn}
          onPress={() => {
            void updateProviderRegistrationDraft({
              track,
              registrationType: selectedType
            });
            navigation.navigate("ProviderPersonalDetails", {
              track,
              registrationType: selectedType
            });
          }}
          accessibilityRole="button"
        >
          <Text style={styles.continueBtnText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color="#000" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 8
  },
  title: {
    color: TEXT,
    fontSize: 40,
    lineHeight: 52,
    fontWeight: "700",
    paddingTop: 4,
    includeFontPadding: false
  },
  titleAccent: {
    color: APP_LIME
  },
  subtitle: {
    marginTop: 10,
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
    includeFontPadding: false
  },
  optionsWrap: {
    marginTop: 28,
    paddingHorizontal: 16,
    gap: 1,
    alignItems: "center"
  },
  optionCard: {
    width: "100%",
    maxWidth: 398,
    height: 133,
    borderRadius: 16,
    padding: 14,
    opacity: 1,
    borderWidth: 0,
    borderBottomWidth: 8,
    borderBottomColor: "transparent",
    backgroundColor: "transparent",
    justifyContent: "center"
  },
  optionCardActive: {
    backgroundColor: "#2a2a2a",
    borderBottomColor: APP_LIME,
    opacity: 1
  },
  optionTitle: {
    color: TEXT,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "500",
    includeFontPadding: false
  },
  optionTitleActive: {
    color: APP_LIME
  },
  optionSubtitle: {
    marginTop: 6,
    color: MUTED,
    fontSize: 12,
    lineHeight: 20,
    includeFontPadding: false
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 12
  },
  continueBtn: {
    backgroundColor: APP_LIME,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  continueBtnText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "800"
  }
});
