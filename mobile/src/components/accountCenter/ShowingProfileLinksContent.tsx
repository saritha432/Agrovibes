import React from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { AccountCenterSubLayout } from "./AccountCenterSubLayout";
import { ProfileLinksCard } from "./ConnectedExperienceCards";
import { showAddConnectedAccountAlert } from "./showAddConnectedAccountAlert";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";
import { useConnectedExperiences } from "../../hooks/useConnectedExperiences";
import { toggleShowLinksOnAccount } from "../../utils/connectedExperiencesStorage";

export function ShowingProfileLinksContent() {
  const { pop } = useAccountCenterSheetNav();
  const { state, loading, user, applyState } = useConnectedExperiences();

  const addAccounts = () => {
    if (!user) return;
    showAddConnectedAccountAlert(user, applyState);
  };

  const openAccount = async (accountId: string, accountName: string) => {
    if (!user) return;
    const enabled = state?.showLinksOnAccountIds.includes(accountId);
    Alert.alert(
      accountName,
      enabled ? "Profile links are currently shown on this profile." : "Profile links are hidden on this profile.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: enabled ? "Hide Links" : "Show Links",
          onPress: async () => {
            const next = await toggleShowLinksOnAccount(user, accountId);
            applyState(next);
          }
        }
      ]
    );
  };

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={pop}
      title="Showing Links For Your Profiles"
      description={
        <Text style={styles.description}>
          Choose where to show links for your profiles, so your audience can discover them more easily.
        </Text>
      }
    >
      <ProfileLinksCard
        accounts={state?.accounts || []}
        loading={loading}
        onPressAccount={(account) => void openAccount(account.id, account.displayName)}
        onAddAccounts={addAccounts}
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
