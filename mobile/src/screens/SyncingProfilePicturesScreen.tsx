import React, { useMemo } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { AccountCenterAddAction } from "../components/accountCenter/AccountCenterAddAction";
import { AccountCenterAvatar } from "../components/accountCenter/AccountCenterAvatar";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSectionTitle,
  AccountCenterSubLayout
} from "../components/accountCenter/AccountCenterSubLayout";
import { CONNECTED_ACCOUNT_SUBTITLES } from "../components/accountCenter/connectedExperiencesData";
import { useAuth } from "../auth/AuthContext";

export function SyncingProfilePicturesScreen() {
  const { user } = useAuth();

  const displayName = useMemo(
    () => user?.fullName || user?.username || "Your profile",
    [user?.fullName, user?.username]
  );

  const startSync = () => Alert.alert("Coming soon", "Profile picture sync will be available in a future update.");

  return (
    <AccountCenterSubLayout
      title="Syncing Profile Pictures"
      description={
        <Text style={styles.description}>
          Keep your profile picture updated across profiles. when you change your picture in one profile, it will
          update on all of the profiles that you've selected.
        </Text>
      }
    >
      <AccountCenterSectionTitle title="Currently Synced" />
      <AccountCenterAddAction label="+ Start Sync" onPress={startSync} />

      <AccountCenterSectionTitle title="Currently Synced" />
      <AccountCenterCard>
        <AccountCenterChevronRow
          title={displayName}
          subtitle={CONNECTED_ACCOUNT_SUBTITLES.main}
          onPress={() => {}}
          showDivider
          left={<AccountCenterAvatar label={displayName} avatarUrl={user?.avatarUrl} />}
        />
        <AccountCenterChevronRow
          title={displayName}
          subtitle={CONNECTED_ACCOUNT_SUBTITLES.whatsapp}
          onPress={() => {}}
          left={<AccountCenterAvatar label={displayName} avatarUrl={user?.avatarUrl} />}
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
  }
});
