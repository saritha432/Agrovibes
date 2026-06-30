import React from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { AccountCenterAddAction } from "../components/accountCenter/AccountCenterAddAction";
import { AccountCenterCard } from "../components/accountCenter/AccountCenterSubLayout";
import { ConnectedAccountRows } from "../components/accountCenter/ConnectedAccountRows";
import { AccountCenterSectionTitle, AccountCenterSubLayout } from "../components/accountCenter/AccountCenterSubLayout";
import { useConnectedExperiences } from "../hooks/useConnectedExperiences";
import { syncAllAccounts, toggleSyncedPictureAccount } from "../utils/connectedExperiencesStorage";

export function SyncingProfilePicturesScreen() {
  const { state, loading, user, applyState } = useConnectedExperiences();

  const startSync = async () => {
    if (!user) return;
    const synced = state?.syncedPictureAccountIds || [];
    if (synced.length === 0) {
      const next = await syncAllAccounts(user);
      applyState(next);
      Alert.alert("Sync started", "Your profile picture will stay in sync across selected profiles.");
      return;
    }
    Alert.alert(
      "Manage Sync",
      "Tap a profile below to add or remove it from picture sync.",
      [{ text: "OK" }]
    );
  };

  const toggleAccount = async (accountId: string) => {
    if (!user) return;
    const next = await toggleSyncedPictureAccount(user, accountId);
    applyState(next);
  };

  const syncedAccounts = (state?.accounts || []).filter((a) => state?.syncedPictureAccountIds.includes(a.id));

  return (
    <AccountCenterSubLayout
      title="Syncing Profile Pictures"
      description={
        <Text style={styles.description}>
          Keep your profile picture updated across profiles. When you change your picture in one profile, it will
          update on all of the profiles that you've selected.
        </Text>
      }
    >
      <AccountCenterSectionTitle title="Currently Synced" />
      <AccountCenterCard>
        <AccountCenterAddAction label="+ Start Sync" onPress={() => void startSync()} compact />
      </AccountCenterCard>

      <ConnectedAccountRows
        title="Currently Synced"
        accounts={syncedAccounts}
        loading={loading}
        emptyText="No profiles are syncing yet. Tap + Start Sync to begin."
        selectedIds={state?.syncedPictureAccountIds || []}
        selectionMode="multi"
        onPressAccount={(account) => void toggleAccount(account.id)}
      />
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 21
  }
});
