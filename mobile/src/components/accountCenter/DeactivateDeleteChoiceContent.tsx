import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AccountCenterCard, AccountCenterSubLayout } from "./AccountCenterSubLayout";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";
import { setPendingDeactivateAction } from "./accountCenterDeactivateFlow";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";

type Option = "deactivate" | "delete";

export function DeactivateDeleteChoiceContent() {
  const { push, pop } = useAccountCenterSheetNav();
  const [selected, setSelected] = useState<Option>("deactivate");

  const handleContinue = () => {
    setPendingDeactivateAction(selected);
    push("DeactivateDeleteContinue");
  };

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={pop}
      title="Deactivate Or Delete Account"
      description={
        <Text style={styles.description}>
          Deactivation is temporary and reversible. Deleting your account is permanent.
        </Text>
      }
      contentStyle={styles.content}
    >
      <AccountCenterCard>
        <ChoiceRow
          title="Deactivate Account"
          subtitle="Hide your profile and content until you log back in."
          selected={selected === "deactivate"}
          onPress={() => setSelected("deactivate")}
          showDivider
        />
        <ChoiceRow
          title="Delete Account"
          subtitle="Permanently remove your account and all associated data."
          selected={selected === "delete"}
          onPress={() => setSelected("delete")}
        />
      </AccountCenterCard>

      <Pressable style={styles.continueBtn} onPress={handleContinue} accessibilityRole="button">
        <Text style={styles.continueText}>Continue</Text>
      </Pressable>
    </AccountCenterSubLayout>
  );
}

function ChoiceRow({
  title,
  subtitle,
  selected,
  onPress,
  showDivider
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  showDivider?: boolean;
}) {
  return (
    <>
      <Pressable style={styles.row} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}>
        <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
          {selected ? <View style={styles.radioInner} /> : null}
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={APP_TEXT_MUTED} />
      </Pressable>
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  description: {
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 21
  },
  content: {
    paddingBottom: 40
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center"
  },
  radioOuterSelected: {
    borderColor: APP_LIME
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: APP_LIME
  },
  rowBody: {
    flex: 1,
    gap: 4
  },
  rowTitle: {
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "600"
  },
  rowSubtitle: {
    color: APP_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 17
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)"
  },
  continueBtn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  continueText: {
    color: "#222",
    fontSize: 15,
    fontWeight: "700"
  },
});

