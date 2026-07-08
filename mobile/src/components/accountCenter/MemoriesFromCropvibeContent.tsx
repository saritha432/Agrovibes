import React from "react";
import { StyleSheet, Text } from "react-native";
import {
  AccountCenterCardTitle,
  AccountCenterStaticRow,
  AccountCenterToggleRow
} from "./ConnectedExperienceCards";
import { AccountCenterCard, AccountCenterSubLayout } from "./AccountCenterSubLayout";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";
import { useConnectedExperiences } from "../../hooks/useConnectedExperiences";
import { setCropvibeMemoriesShareEnabled, setMemoriesShareToAccount } from "../../utils/connectedExperiencesStorage";

export function MemoriesFromCropvibeContent() {
  const { pop } = useAccountCenterSheetNav();
  const { state, user, applyState } = useConnectedExperiences();

  const mainAccount = state?.accounts.find((a) => a.platform === "cropvibe");
  const destinationAccounts = (state?.accounts || []).filter((a) => a.platform !== "cropvibe");

  const toggleShareFrom = async (enabled: boolean) => {
    if (!user) return;
    const next = await setCropvibeMemoriesShareEnabled(user, enabled);
    applyState(next);
  };

  const selectShareTo = (accountId: string) => {
    if (!user) return;
    void (async () => {
      const next = await setMemoriesShareToAccount(user, accountId);
      applyState(next);
    })();
  };

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={pop}
      title="Memories From Cropvibe"
      description={
        <Text style={styles.description}>You can choose to include content from your Cropvibe Profiles.</Text>
      }
    >
      {mainAccount ? (
        <AccountCenterCard>
          <AccountCenterCardTitle title="Share Memories From" />
          <AccountCenterToggleRow
            account={mainAccount}
            value={Boolean(state?.cropvibeMemoriesShareEnabled)}
            onValueChange={(value) => void toggleShareFrom(value)}
          />
        </AccountCenterCard>
      ) : null}

      <AccountCenterCard>
        <AccountCenterCardTitle title="Share To" />
        {destinationAccounts.length === 0 ? (
          <Text style={styles.emptyText}>Link WhatsApp or Instagram to choose a destination.</Text>
        ) : (
          destinationAccounts.map((account, index) => (
            <AccountCenterStaticRow
              key={account.id}
              account={account}
              onPress={() => selectShareTo(account.id)}
              selected={state?.memoriesShareToAccountId === account.id}
              showChevron={false}
              showDivider={index < destinationAccounts.length - 1}
            />
          ))
        )}
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
  emptyText: {
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingBottom: 14
  }
});
