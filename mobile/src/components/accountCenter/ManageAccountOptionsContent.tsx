import React from "react";
import { StyleSheet, Text } from "react-native";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSubLayout
} from "./AccountCenterSubLayout";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";

export function ManageAccountOptionsContent() {
  const { push, pop } = useAccountCenterSheetNav();

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={pop}
      title="Account Ownership And Control"
      description={
        <Text style={styles.description}>
          Keep, deactivate, or permanently delete this account based on what you need.
        </Text>
      }
      contentStyle={styles.content}
    >
      <AccountCenterCard>
        <AccountCenterChevronRow
          title="Deactivate or Delete"
          subtitle="Temporarily disable or permanently remove this account."
          onPress={() => push("DeactivateDeleteChoice")}
        />
      </AccountCenterCard>
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
  }
});

