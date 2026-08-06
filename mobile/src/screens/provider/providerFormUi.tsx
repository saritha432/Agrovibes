import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";

export const PROVIDER_BG = "#1a1a1a";
export const PROVIDER_CARD = "#2b2c2e";
export const PROVIDER_TEXT = APP_TEXT;
export const PROVIDER_MUTED = APP_TEXT_MUTED;
export const PROVIDER_DIVIDER = "rgba(255,255,255,0.08)";

export const PROVIDER_STEPS = [
  { id: 1, label: "Personal Details", sub: "Description Text" },
  { id: 2, label: "Bank Details", sub: "For earnings" },
  { id: 3, label: "KYC Verification", sub: "Upload documents" },
  { id: 4, label: "Verification", sub: "Submit for review" }
] as const;

/** Show current step ±1 to match compact App Store-style step chips. */
export function visibleProviderSteps(currentStep: number) {
  const ids =
    currentStep <= 2
      ? [1, 2, 3]
      : currentStep === 3
        ? [2, 3, 4]
        : [2, 3, 4];
  return PROVIDER_STEPS.filter((s) => ids.includes(s.id));
}

export function ProviderFormHeader({
  title = "Settings & Privacy",
  onBack
}: {
  title?: string;
  onBack: () => void;
}) {
  return (
    <View style={ui.topBar}>
      <Pressable style={ui.backBtn} onPress={onBack} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={24} color={APP_LIME} />
      </Pressable>
      <Text style={ui.topTitle}>{title}</Text>
      <View style={ui.backBtn} />
    </View>
  );
}

export function ProviderStepBar({ currentStep }: { currentStep: number }) {
  const steps = visibleProviderSteps(currentStep);
  return (
    <View style={ui.stepBar}>
      {steps.map((step, index) => {
        const active = step.id === currentStep;
        const done = step.id < currentStep;
        return (
          <React.Fragment key={step.id}>
            <View style={ui.stepItem}>
              <View style={[ui.stepNum, active && ui.stepNumActive, done && ui.stepNumDone]}>
                {done ? (
                  <Ionicons name="checkmark" size={12} color="#000" />
                ) : (
                  <Text style={[ui.stepNumText, active && ui.stepNumTextActive]}>
                    {String(step.id).padStart(2, "0")}
                  </Text>
                )}
              </View>
              {step.label ? (
                <View style={ui.stepCopy}>
                  <Text style={[ui.stepLabel, active && ui.stepLabelActive]} numberOfLines={1}>
                    {step.label}
                  </Text>
                  <Text style={ui.stepSub} numberOfLines={1}>
                    {step.sub}
                  </Text>
                </View>
              ) : null}
            </View>
            {index < steps.length - 1 ? (
              <View style={[ui.stepLine, done && ui.stepLineDone]} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export function ProviderContinueButton({
  label = "Continue",
  onPress,
  disabled
}: {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={ui.footer}>
      <Pressable
        style={[ui.nextBtn, disabled && ui.nextBtnDisabled]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
      >
        <Text style={[ui.nextBtnText, disabled && ui.nextBtnTextDisabled]}>{label}</Text>
        <Ionicons name="arrow-forward" size={18} color={disabled ? "#666" : "#000"} />
      </Pressable>
    </View>
  );
}

export const providerFormStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PROVIDER_BG },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },
  sectionTitle: { color: PROVIDER_TEXT, fontSize: 22, fontWeight: "700", marginBottom: 4 },
  sectionSub: { color: PROVIDER_MUTED, fontSize: 13, marginBottom: 16 },
  fieldLabel: { color: PROVIDER_TEXT, fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 4 },
  fieldGap: { height: 12 },
  input: {
    backgroundColor: PROVIDER_CARD,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: PROVIDER_TEXT,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 10
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "transparent"
  },
  chipActive: { borderColor: APP_LIME, backgroundColor: "rgba(201,255,53,0.1)" },
  chipText: { color: PROVIDER_MUTED, fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: APP_LIME, fontWeight: "700" }
});

const ui = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { flex: 1, textAlign: "center", color: PROVIDER_TEXT, fontSize: 15, fontWeight: "600" },
  stepBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: PROVIDER_DIVIDER
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "38%" },
  stepCopy: { flexShrink: 1 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: PROVIDER_MUTED,
    alignItems: "center",
    justifyContent: "center"
  },
  stepNumActive: { borderColor: APP_LIME, backgroundColor: "transparent" },
  stepNumDone: { borderColor: APP_LIME, backgroundColor: APP_LIME },
  stepNumText: { color: PROVIDER_MUTED, fontSize: 10, fontWeight: "700" },
  stepNumTextActive: { color: APP_LIME },
  stepLabel: { color: PROVIDER_MUTED, fontSize: 11, fontWeight: "600" },
  stepLabelActive: { color: APP_LIME },
  stepSub: { color: "rgba(255,255,255,0.35)", fontSize: 9 },
  stepLine: { flex: 1, height: 1, backgroundColor: PROVIDER_MUTED, marginHorizontal: 6 },
  stepLineDone: { backgroundColor: APP_LIME },
  footer: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  nextBtn: {
    backgroundColor: APP_LIME,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  nextBtnDisabled: { backgroundColor: "#3a3a3a" },
  nextBtnText: { color: "#000", fontSize: 15, fontWeight: "800" },
  nextBtnTextDisabled: { color: "#888" }
});
