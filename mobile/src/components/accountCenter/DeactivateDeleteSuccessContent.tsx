import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AccountCenterSubLayout } from "./AccountCenterSubLayout";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";
import { clearPendingDeactivateAction } from "./accountCenterDeactivateFlow";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";

export function DeactivateDeleteSuccessContent() {
  const { close } = useAccountCenterSheetNav();

  const handleDone = () => {
    clearPendingDeactivateAction();
    close();
  };

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={handleDone}
      title="Account Deactivated"
      description={
        <Text style={styles.description}>
          Your account has been deactivated. Your profile and content are hidden until you activate your account again.
        </Text>
      }
      contentStyle={styles.content}
    >
      <View style={styles.infoCard}>
        <Ionicons name="checkmark-circle-outline" size={28} color={APP_LIME} />
        <Text style={styles.infoText}>
          You can reactivate anytime from Home, Search, Chat, or Profile by tapping Activate Account.
        </Text>
      </View>

      <Pressable style={styles.doneBtn} onPress={handleDone} accessibilityRole="button">
        <Text style={styles.doneText}>Done</Text>
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
