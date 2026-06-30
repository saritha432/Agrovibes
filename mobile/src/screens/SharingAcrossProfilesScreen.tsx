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

export function SharingAcrossProfilesScreen() {
  const { user } = useAuth();

  const displayName = useMemo(
    () => user?.fullName || user?.username || "Your profile",
    [user?.fullName, user?.username]
  );

  const addAccounts = () => Alert.alert("Coming soon", "Account linking will be available in a future update.");

  return (
    <AccountCenterSubLayout
      title="Sharing Across Profiles"
      description={
        <Text style={styles.description}>
          Choose a profile to control how you share content, such as stories and posts, across profiles.
        </Text>
      }
      contentStyle={styles.content}
    >
      <AccountCenterSectionTitle title="Share From" />
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
