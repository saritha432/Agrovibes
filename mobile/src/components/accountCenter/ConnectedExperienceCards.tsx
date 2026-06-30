import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AccountCenterAvatar } from "./AccountCenterAvatar";
import { AccountCenterCard } from "./AccountCenterSubLayout";
import type { ConnectedAccount } from "../../utils/connectedExperiencesStorage";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";

export function AccountCenterCardTitle({ title }: { title: string }) {
  return <Text style={styles.cardTitle}>{title}</Text>;
}

type AccountCenterToggleRowProps = {
  account: ConnectedAccount;
  value: boolean;
  onValueChange: (value: boolean) => void;
  showDivider?: boolean;
};

export function AccountCenterToggleRow({ account, value, onValueChange, showDivider }: AccountCenterToggleRowProps) {
  return (
    <>
      <View style={styles.row}>
        <AccountCenterAvatar label={account.displayName} avatarUrl={account.avatarUrl} />
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{account.displayName}</Text>
          <Text style={styles.rowSubtitle}>{account.subtitle}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: "#3a3a3a", true: "rgba(201, 255, 53, 0.35)" }}
          thumbColor={value ? APP_LIME : "#9ca3af"}
        />
      </View>
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

type AccountCenterStaticRowProps = {
  account: ConnectedAccount;
  showDivider?: boolean;
  onPress?: () => void;
  selected?: boolean;
  showChevron?: boolean;
};

export function AccountCenterStaticRow({
  account,
  showDivider,
  onPress,
  selected,
  showChevron = true
}: AccountCenterStaticRowProps) {
  const content = (
    <View style={styles.row}>
      <AccountCenterAvatar label={account.displayName} avatarUrl={account.avatarUrl} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, selected ? styles.rowTitleSelected : null]}>{account.displayName}</Text>
        <Text style={styles.rowSubtitle}>{account.subtitle}</Text>
      </View>
      {onPress && showChevron ? <Ionicons name="chevron-forward" size={18} color={APP_TEXT_MUTED} /> : null}
    </View>
  );

  return (
    <>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={account.displayName}>
          {content}
        </Pressable>
      ) : (
        content
      )}
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

export function ProfileLinksCard({
  accounts,
  loading,
  onPressAccount,
  onAddAccounts
}: {
  accounts: ConnectedAccount[];
  loading?: boolean;
  onPressAccount: (account: ConnectedAccount) => void;
  onAddAccounts: () => void;
}) {
  return (
    <AccountCenterCard>
      <AccountCenterCardTitle title="Show Links On" />
      {loading ? (
        <ActivityIndicator color={APP_LIME} style={styles.loader} />
      ) : (
        accounts.map((account, index) => (
          <AccountCenterStaticRow
            key={account.id}
            account={account}
            onPress={() => onPressAccount(account)}
            showDivider={index < accounts.length - 1}
          />
        ))
      )}
      <Pressable style={styles.addRow} onPress={onAddAccounts} accessibilityRole="button" accessibilityLabel="Add Accounts">
        <Text style={styles.addLabel}>+ Add Accounts</Text>
      </Pressable>
    </AccountCenterCard>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12
  },
  rowBody: {
    flex: 1,
    gap: 4
  },
  rowTitle: {
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "600"
  },
  rowTitleSelected: {
    color: APP_LIME
  },
  rowSubtitle: {
    color: APP_TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3a3a3a",
    marginLeft: 14
  },
  loader: {
    marginVertical: 12
  },
  addRow: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  addLabel: {
    color: APP_LIME,
    fontSize: 15,
    fontWeight: "700"
  }
});
