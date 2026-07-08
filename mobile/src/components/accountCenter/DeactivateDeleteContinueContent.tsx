import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AccountCenterSubLayout } from "./AccountCenterSubLayout";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";

export function DeactivateDeleteContinueContent() {
  const { pop, push } = useAccountCenterSheetNav();

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={pop}
      title="Before You Continue"
      description={
        <Text style={styles.description}>
          You may be asked to confirm your password and review what happens to your profile before final submission.
        </Text>
      }
      contentStyle={styles.content}
    >
      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={24} color={APP_LIME} />
        <Text style={styles.infoText}>
          We will guide you through final confirmation on the next secure step for your account.
        </Text>
      </View>

      <Pressable style={styles.doneBtn} onPress={() => push("DeactivateDeleteConfirmPassword")} accessibilityRole="button">
        <Text style={styles.doneText}>Continue</Text>
      </Pressable>
    </AccountCenterSubLayout>
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
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#303132",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  infoText: {
    flex: 1,
    color: APP_TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18
  },
  doneBtn: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  doneText: {
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "700"
  }
});

