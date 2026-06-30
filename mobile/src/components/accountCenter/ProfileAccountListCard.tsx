import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AccountCenterAvatar } from "./AccountCenterAvatar";
import { AccountCenterCard } from "./AccountCenterSubLayout";
import type { ProfileAccount } from "../../utils/contactsUploadStorage";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";

type ProfileAccountListCardProps = {
  sectionTitle?: string;
  headerActionLabel?: string;
  onHeaderAction?: () => void;
  accounts: ProfileAccount[];
  loading?: boolean;
  selectedId?: string | null;
  onPressAccount?: (account: ProfileAccount) => void;
  selectionMode?: boolean;
};

export function ProfileAccountListCard({
  sectionTitle,
  headerActionLabel,
  onHeaderAction,
  accounts,
  loading,
  selectedId,
  onPressAccount,
  selectionMode = false
}: ProfileAccountListCardProps) {
  return (
    <AccountCenterCard>
      {sectionTitle || headerActionLabel ? (
        <View style={styles.cardHeader}>
          {sectionTitle ? <Text style={styles.cardHeaderTitle}>{sectionTitle}</Text> : <View />}
          {headerActionLabel && onHeaderAction ? (
            <Pressable onPress={onHeaderAction} accessibilityRole="button">
              <Text style={styles.cardHeaderAction}>{headerActionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={APP_LIME} style={styles.loader} />
      ) : (
        accounts.map((account, index) => {
          const selected = selectionMode && selectedId === account.id;
          const initial = account.displayName.trim().charAt(0).toUpperCase() || "?";
          return (
            <View key={account.id}>
              <Pressable
                style={styles.row}
                onPress={() => onPressAccount?.(account)}
                disabled={!onPressAccount}
                accessibilityRole="button"
              >
                {selectionMode ? (
                  <View style={[styles.selectBadge, selected && styles.selectBadgeActive]}>
                    {selected ? <Text style={styles.selectBadgeText}>{initial}</Text> : null}
                  </View>
                ) : (
                  <AccountCenterAvatar label={account.displayName} avatarUrl={account.avatarUrl} />
                )}
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, selected ? styles.rowTitleSelected : null]}>{account.displayName}</Text>
                  <Text style={styles.rowSubtitle}>{account.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={APP_TEXT_MUTED} />
              </Pressable>
              {index < accounts.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          );
        })
      )}
    </AccountCenterCard>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6
  },
  cardHeaderTitle: {
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "700"
  },
  cardHeaderAction: {
    color: APP_LIME,
    fontSize: 15,
    fontWeight: "700"
  },
  loader: {
    marginVertical: 16
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
  selectBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4a4a4a",
    alignItems: "center",
    justifyContent: "center"
  },
  selectBadgeActive: {
    backgroundColor: APP_LIME
  },
  selectBadgeText: {
    color: "#262626",
    fontSize: 16,
    fontWeight: "800"
  }
});
