import React from "react";
import { StyleSheet, Text } from "react-native";
import { AccountCenterAddAction } from "./AccountCenterAddAction";
import { ConnectedAccountRows } from "./ConnectedAccountRows";
import { AccountCenterSubLayout } from "./AccountCenterSubLayout";
import { showAddConnectedAccountAlert } from "./showAddConnectedAccountAlert";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";
import { useConnectedExperiences } from "../../hooks/useConnectedExperiences";
import { setSharingFromAccount } from "../../utils/connectedExperiencesStorage";

export function SharingAcrossProfilesContent() {
  const { pop } = useAccountCenterSheetNav();
  const { state, loading, user, applyState } = useConnectedExperiences();

  const addAccounts = () => {
    if (!user) return;
    showAddConnectedAccountAlert(user, applyState);
  };

  const selectShareFrom = async (accountId: string) => {
    if (!user) return;
    const next = await setSharingFromAccount(user, accountId);
    applyState(next);
  };

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={pop}
      title="Sharing Across Profiles"
      description={
        <Text style={styles.description}>
          Choose a profile to control how you share content, such as stories and posts, across profiles.
        </Text>
      }
      contentStyle={styles.content}
    >
      <ConnectedAccountRows
        title="Share From"
        accounts={state?.accounts || []}
        loading={loading}
        selectedIds={state?.sharingFromAccountId ? [state.sharingFromAccountId] : []}
        selectionMode="single"
        onPressAccount={(account) => void selectShareFrom(account.id)}
      />

      <AccountCenterAddAction label="+ Add Accounts" onPress={addAccounts} />

      <Text style={styles.footerNote}>
        To manage sharing from whatsapp, go to accounts centre on whatsapp.
      </Text>
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
  footerNote: {
    color: "#97a0a8",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8
  }
});
