import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AccountCenterAvatar } from "./AccountCenterAvatar";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSectionTitle
} from "./AccountCenterSubLayout";
import type { ConnectedAccount } from "../../utils/connectedExperiencesStorage";
import { APP_LIME, APP_TEXT_MUTED } from "../../theme/appColors";

type ConnectedAccountRowsProps = {
  title?: string;
  accounts: ConnectedAccount[];
  loading?: boolean;
  emptyText?: string;
  onPressAccount: (account: ConnectedAccount) => void;
  selectedIds?: string[];
  selectionMode?: "single" | "multi" | "none";
};

export function ConnectedAccountRows({
  title,
  accounts,
  loading,
  emptyText = "No connected accounts yet.",
  onPressAccount,
  selectedIds = [],
  selectionMode = "none"
}: ConnectedAccountRowsProps) {
  return (
    <>
      {title ? <AccountCenterSectionTitle title={title} /> : null}
      {loading ? (
        <ActivityIndicator color={APP_LIME} style={styles.loader} />
      ) : (
        <AccountCenterCard>
          {accounts.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          ) : (
            accounts.map((account, index) => (
              <AccountCenterChevronRow
                key={account.id}
                title={account.displayName}
                subtitle={account.subtitle}
                onPress={() => onPressAccount(account)}
                showDivider={index < accounts.length - 1}
                left={<AccountCenterAvatar label={account.displayName} avatarUrl={account.avatarUrl} />}
                titleColor={
                  selectedIds.includes(account.id) && selectionMode !== "none" ? APP_LIME : undefined
                }
              />
            ))
          )}
        </AccountCenterCard>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginVertical: 12
  },
  emptyWrap: {
    paddingHorizontal: 14,
    paddingVertical: 18
  },
  emptyText: {
    color: APP_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 20
  }
});
