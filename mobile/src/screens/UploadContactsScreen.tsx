import React, { useCallback, useMemo, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AccountCenterSectionTitle, AccountCenterSubLayout } from "../components/accountCenter/AccountCenterSubLayout";
import { ProfileAccountListCard } from "../components/accountCenter/ProfileAccountListCard";
import { useAuth } from "../auth/AuthContext";
import {
  buildProfileAccounts,
  readContactsUploadState,
  toggleContactsSync
} from "../utils/contactsUploadStorage";

export function UploadContactsScreen() {
  const { user } = useAuth();
  const [syncIds, setSyncIds] = useState<string[]>([]);

  const accounts = useMemo(() => (user ? buildProfileAccounts(user) : []), [user]);

  const reload = useCallback(async () => {
    const state = await readContactsUploadState();
    setSyncIds(state.syncEnabledByProfileId);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const openProfile = async (profileId: string, profileName: string) => {
    if (!user) return;
    const enabled = syncIds.includes(profileId);
    Alert.alert(
      profileName,
      enabled ? "Contact syncing is on for this profile." : "Contact syncing is off for this profile.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: enabled ? "Turn Off" : "Turn On",
          onPress: async () => {
            const next = await toggleContactsSync(profileId);
            setSyncIds(next.syncEnabledByProfileId);
          }
        }
      ]
    );
  };

  return (
    <AccountCenterSubLayout
      title="Upload Contacts"
      description={
        <Text style={styles.description}>
          Upload and sync your contacts to cropvibe to easily connect with farmers, buyers, sellers, and agribusiness
          partners. You can manage contact syncing individually for each linked account at any time.
        </Text>
      }
      contentStyle={styles.content}
    >
      <AccountCenterSectionTitle title="Your Profiles" />
      <ProfileAccountListCard
        accounts={accounts}
        onPressAccount={(account) => void openProfile(account.id, account.displayName)}
      />
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
