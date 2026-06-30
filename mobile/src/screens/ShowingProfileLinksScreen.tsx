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

export function ShowingProfileLinksScreen() {
  const { user } = useAuth();

  const displayName = useMemo(
    () => user?.fullName || user?.username || "Your profile",
    [user?.fullName, user?.username]
  );

  const addAccounts = () => Alert.alert("Coming soon", "Account linking will be available in a future update.");

  return (
    <AccountCenterSubLayout
      title="Showing Links For Your Profiles"
      description={
        <Text style={styles.description}>
          Choose where to show links for your profiles so your audience can discover them more easily.
        </Text>
      }
    >
      <AccountCenterSectionTitle title="Show Links On" />
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
