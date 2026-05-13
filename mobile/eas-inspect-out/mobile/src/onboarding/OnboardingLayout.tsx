import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const GREEN = "#0a9f46";
const BORDER = "#dce3e1";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  onBack?: () => void;
  showBack?: boolean;
}

export function OnboardingLayout({
  title,
  subtitle,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  onBack,
  showBack = true
}: Props) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.bottom} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        {showBack && onBack ? (
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={18} color="#22312d" />
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.card}>{children}</View>
      <Pressable
        onPress={onPrimary}
        style={[styles.btn, primaryDisabled ? styles.btnDisabled : null]}
        disabled={primaryDisabled}
      >
        <Text style={styles.btnText}>{primaryLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  bottom: { paddingBottom: 48, paddingHorizontal: 12 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 12, paddingBottom: 8 },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  backPlaceholder: { width: 34 },
  headerText: { flex: 1 },
  title: { fontWeight: "900", color: "#111616", fontSize: 20 },
  subtitle: { marginTop: 6, fontWeight: "600", color: "#5b6966", fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14
  },
  btn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 15 }
});

export const onboardingTheme = { GREEN, BORDER };
