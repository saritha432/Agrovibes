import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

const BG = "#171717";
const CARD = "#2b2c2e";
const TEXT = APP_TEXT;
const MUTED = APP_TEXT_MUTED;

type RuleSection = {
  title: string;
  body: string[];
};

const PAGE_ONE: RuleSection[] = [
  {
    title: "1. Eligibility",
    body: [
      "By registering as a Rental Provider, you confirm that you are at least 18 years old and legally authorized to rent out agricultural machinery, equipment, vehicles, or provide related services."
    ]
  },
  {
    title: "2. Services You Can Offer",
    body: [
      "Rental Providers may list:",
      "• Tractors and harvesters",
      "• Agricultural machinery and equipment",
      "• Drivers/operators",
      "• Agricultural labor services",
      "• Other approved farming-related rental services"
    ]
  },
  {
    title: "3. Accurate Information",
    body: [
      "You agree to provide accurate and up-to-date information, including:",
      "• Name and contact details",
      "• Equipment details and condition",
      "• Rental pricing"
    ]
  }
];

const PAGE_TWO_EXTRA = [
  "• Availability schedule",
  "• Government ID, Aadhaar, GST, Farmer ID, or other",
  "I agree to the Rental Provider Terms & Conditions, confirm that the information and documents provided are accurate, and accept responsibility for the safety and condition of the listed equipment and services."
];

function TermsSection({ section }: { section: RuleSection }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.body.map((line) => (
        <Text key={`${section.title}-${line}`} style={styles.sectionBody}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export function ProviderTermsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [page, setPage] = useState(1);
  const [accepted, setAccepted] = useState(false);

  const sections = useMemo(() => {
    if (page === 1) return PAGE_ONE;
    const next = [...PAGE_ONE];
    const infoSection = next[2];
    if (infoSection) {
      next[2] = {
        ...infoSection,
        body: [...infoSection.body, ...PAGE_TWO_EXTRA]
      };
    }
    return next;
  }, [page]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={APP_LIME} />
        </Pressable>
        <Text style={styles.topTitle}>Terms And Condition</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.pageBadgeWrap}>
        <Text style={styles.pageBadge}>RENTAL PROVIDER</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {sections.map((section) => (
            <TermsSection key={section.title} section={section} />
          ))}

          {page === 2 ? (
            <Pressable style={styles.checkRow} onPress={() => setAccepted((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
              <Ionicons
                name={accepted ? "checkbox-outline" : "square-outline"}
                size={20}
                color={accepted ? APP_LIME : MUTED}
              />
              <Text style={styles.checkText}>
                I agree to the Rental Provider Terms & Conditions and accept all responsibilities.
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {page === 1 ? (
          <Pressable style={styles.cta} onPress={() => setPage(2)} accessibilityRole="button">
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.cta, !accepted && styles.ctaDisabled]}
            disabled={!accepted}
            onPress={() => navigation.navigate("ProviderOfferRole")}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Accept And Join As Provider</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { flex: 1, textAlign: "center", color: TEXT, fontSize: 16, fontWeight: "600" },
  pageBadgeWrap: { alignItems: "center", marginBottom: 10 },
  pageBadge: { color: APP_LIME, fontSize: 14, fontWeight: "700" },
  content: { paddingHorizontal: 12, paddingBottom: 16 },
  card: {
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)"
  },
  section: { marginBottom: 14 },
  sectionTitle: { color: APP_LIME, fontSize: 16, fontWeight: "700", marginBottom: 6 },
  sectionBody: { color: MUTED, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  checkRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 4 },
  checkText: { color: MUTED, fontSize: 11, lineHeight: 16, flex: 1 },
  footer: { paddingHorizontal: 12, paddingBottom: 16, paddingTop: 8 },
  cta: {
    backgroundColor: "#2d2f31",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.2)",
    paddingVertical: 14,
    alignItems: "center"
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: APP_LIME, fontSize: 15, fontWeight: "700" }
});
