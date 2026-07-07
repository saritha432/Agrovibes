import React, { useCallback, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AccountCenterAvatar } from "./AccountCenterAvatar";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSubLayout
} from "./AccountCenterSubLayout";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";
import { useAuth } from "../../auth/AuthContext";
import { readSavedLogins, type SavedLoginAccount } from "../../utils/savedLogins";
import { roleAccountLabel } from "../../utils/loginActivityFormatters";

export function ManageAccountsContent() {
  const { push, pop } = useAccountCenterSheetNav();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SavedLoginAccount[]>([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const load = async () => {
        const saved = await readSavedLogins();
        if (!mounted) return;
        if (saved.length > 0) {
          setAccounts(saved);
          return;
        }
        if (user) {
          setAccounts([
            {
              userId: user.id,
              displayName: user.fullName || user.username || "Your profile",
              accountType: roleAccountLabel(user.role),
              avatarUrl: user.avatarUrl,
              role: user.role,
              lastUsedAt: new Date().toISOString()
            }
          ]);
        } else {
          setAccounts([]);
        }
      };
      void load();
      return () => {
        mounted = false;
      };
    }, [user])
  );

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={pop}
      title="Manage Accounts"
      description={<Text style={styles.description}>Choose an account to update account status and ownership settings.</Text>}
      contentStyle={styles.content}
    >
      <AccountCenterCard>
        {accounts.map((account, index) => (
          <AccountCenterChevronRow
            key={`${account.userId}-${index}`}
            title={account.displayName}
            subtitle={account.accountType}
            onPress={() => push("ManageAccountOptions")}
            showDivider={index < accounts.length - 1}
            left={<AccountCenterAvatar label={account.displayName} avatarUrl={account.avatarUrl} />}
          />
        ))}
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
  content: {
    paddingBottom: 40
  }
});

