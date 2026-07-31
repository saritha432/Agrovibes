import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

const BG = "#1f1f1f";
const TEXT = APP_TEXT;
const MUTED = APP_TEXT_MUTED;

type OfferRole = "service" | "rental" | "both";

const ROLE_OPTIONS: Array<{ id: OfferRole; title: string; subtitle: string }> = [
  {
    id: "service",
    title: "Service Provider",
    subtitle: "Offer expert services like soil testing, repairs, or technical support."
  },
  {
    id: "rental",
    title: "Rental Provider",
    subtitle: "Rent out machinery, labour, drivers, vehicles, or warehouse space."
  },
  {
    id: "both",
    title: "Rental & Service",
    subtitle: "Complete both registrations now together for equipment and other services in one session."
  }
];

export function ProviderOfferRoleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [selectedRole, setSelectedRole] = useState<OfferRole>("rental");

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
          What Would You <Text style={styles.titleAccent}>Like</Text>
        </Text>
        <Text style={styles.title}>
          <Text style={styles.titleAccent}>To Offer?</Text>
        </Text>
        <Text style={styles.subtitle}>
          Pick a track to begin. You can add a second role later from your dashboard.
        </Text>
      </View>

      <View style={styles.optionsWrap}>
        {ROLE_OPTIONS.map((option) => {
          const active = selectedRole === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setSelectedRole(option.id)}
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
            if (selectedRole === "service") {
              navigation.navigate("ProviderServiceForm");
              return;
            }
            if (selectedRole === "both") {
              navigation.navigate("ProviderRentalForm", { both: true });
              return;
            }
            navigation.navigate("ProviderRentalForm");
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
    lineHeight: 44,
    fontWeight: "700"
  },
  titleAccent: {
    color: APP_LIME
  },
  subtitle: {
    marginTop: 10,
    color: MUTED,
    fontSize: 13,
    lineHeight: 18
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
    lineHeight: 24,
    fontWeight: "500"
  },
  optionTitleActive: {
    color: APP_LIME
  },
  optionSubtitle: {
    marginTop: 6,
    color: MUTED,
    fontSize: 12,
    lineHeight: 20
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
